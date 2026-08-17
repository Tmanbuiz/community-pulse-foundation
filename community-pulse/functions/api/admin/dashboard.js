/* =========================================================
   GET /api/admin/dashboard
   ---------------------------------------------------------
   Answers one question: what needs attention today?

   Deliberately not a generic stats endpoint. Counts are here
   because they drive an action, and the work queue is the
   part that actually matters.
   ========================================================= */

import { requireAdmin, adminJson, denied } from '../../_lib/admin-auth.js';

export async function onRequestGet(context) {
  const auth = await requireAdmin(context, 'VIEWER');
  if (!auth.ok) return denied(auth);

  const { env } = context;

  try {
    const staleRow = await env.DB
      .prepare("SELECT value FROM settings WHERE key = 'stale_review_days'")
      .first();
    const staleDays = Number(staleRow && staleRow.value) || 7;

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const staleCutoff = new Date(Date.now() - staleDays * 86400000).toISOString();

    const [
      counts, recent, failedMail, failedMailTotal, stale, enquiryCounts, recentEnquiries,
      upcomingEvents, needsAttendance
    ] = await env.DB.batch([
      // Single pass for the summary cards. Archived records are excluded
      // everywhere except their own count.
      env.DB.prepare(
        `SELECT
           SUM(CASE WHEN created_at >= ?1 AND archived_at IS NULL THEN 1 ELSE 0 END) AS new_7d,
           SUM(CASE WHEN status = 'NEW'       AND archived_at IS NULL THEN 1 ELSE 0 END) AS pending_review,
           SUM(CASE WHEN status = 'CONTACTED' AND archived_at IS NULL THEN 1 ELSE 0 END) AS contacted,
           SUM(CASE WHEN status = 'ACTIVE'    AND archived_at IS NULL THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived,
           COUNT(*) AS total
         FROM volunteers`
      ).bind(sevenDaysAgo),

      env.DB.prepare(
        `SELECT v.id, v.public_ref, v.first_name, v.last_name, v.status, v.created_at,
                (SELECT group_concat(interest_code)
                   FROM volunteer_interests WHERE volunteer_id = v.id) AS interests
           FROM volunteers v
          WHERE v.archived_at IS NULL
          ORDER BY v.created_at DESC
          LIMIT 8`
      ),

      // The retry queue. A failed acknowledgement is the one failure a
      // volunteer would actually notice, so it leads the work list.
      //
      // Unioned with enquiry_communications: that table exists purely so
      // enquiry status-update emails can fail and be tracked, but nothing
      // previously read it here, so a failed enquiry email was invisible to
      // every admin unless someone thought to query the database directly.
      // 'kind' tells the UI which profile to link to and, for the fixed-in-
      // this-round retry.js, which rows retry.js can actually regenerate -
      // it only knows how to rebuild ACKNOWLEDGEMENT and ADMIN_NOTIFICATION
      // content from data already on the volunteer row. STATUS_UPDATE and
      // EVENT_ASSIGNMENT emails carry a specific status transition and an
      // optional freeform note that are not stored anywhere retrievable, so
      // they cannot be safely regenerated - those rows are surfaced for
      // visibility, with a prompt to follow up directly, rather than offered
      // a Retry button that would fail.
      // Every column is aliased explicitly. In a compound SELECT, ORDER BY
      // resolves against the *named* result columns of the first branch, so
      // an unaliased `c.updated_at` gives "1st ORDER BY term does not match
      // any column in the result set" - and the same omission would leave
      // r.updated_at undefined when mapping the rows below.
      env.DB.prepare(
        `SELECT 'volunteer' AS kind, c.id AS id, c.type AS type,
                c.to_address AS to_address, c.attempts AS attempts,
                c.error_message AS error_message, c.updated_at AS updated_at,
                v.public_ref AS reference, (v.first_name || ' ' || v.last_name) AS name
           FROM communications c
           JOIN volunteers v ON v.id = c.volunteer_id
          WHERE c.status = 'FAILED'
         UNION ALL
         SELECT 'enquiry' AS kind, ec.id AS id, ec.type AS type,
                ec.to_address AS to_address, ec.attempts AS attempts,
                ec.error_message AS error_message, ec.updated_at AS updated_at,
                e.public_ref AS reference, (e.first_name || ' ' || e.last_name) AS name
           FROM enquiry_communications ec
           JOIN enquiries e ON e.id = ec.enquiry_id
          WHERE ec.status = 'FAILED'
          ORDER BY updated_at DESC
          LIMIT 20`
      ),

      // The stat tile needs the true count, not the length of the LIMIT 20
      // list above - reusing that length silently capped the figure at 20
      // during exactly the kind of sustained outage where an accurate count
      // matters most.
      env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM communications WHERE status = 'FAILED') +
           (SELECT COUNT(*) FROM enquiry_communications WHERE status = 'FAILED') AS total`
      ),

      // Sat untouched too long: still NEW, never contacted, past the cutoff.
      env.DB.prepare(
        `SELECT id, public_ref, first_name, last_name, created_at
           FROM volunteers
          WHERE status = 'NEW'
            AND archived_at IS NULL
            AND last_contact_at IS NULL
            AND created_at < ?1
          ORDER BY created_at ASC
          LIMIT 20`
      ).bind(staleCutoff),

      // Enquiries. `awaitingFunds` is the one that costs real money if it is
      // missed: someone said they would give, and nobody has reconciled it.
      env.DB.prepare(
        `SELECT
           SUM(CASE WHEN status = 'NEW' AND archived_at IS NULL THEN 1 ELSE 0 END) AS unanswered,
           SUM(CASE WHEN type = 'FINANCIAL' AND funds_received = 0 AND archived_at IS NULL THEN 1 ELSE 0 END) AS awaiting_funds,
           SUM(CASE WHEN ack_status = 'FAILED' THEN 1 ELSE 0 END) AS failed_acks,
           SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) AS open_total
         FROM enquiries`
      ),

      env.DB.prepare(
        `SELECT id, public_ref, type, first_name, last_name, status, created_at,
                amount_declared, amount_received, funds_received
           FROM enquiries
          WHERE archived_at IS NULL
          ORDER BY created_at DESC
          LIMIT 6`
      ),

      // What is coming up, soonest first.
      env.DB.prepare(
        `SELECT e.id, e.public_ref, e.title, e.location, e.starts_at, e.capacity, e.status,
                (SELECT COUNT(*) FROM event_assignments a
                  WHERE a.event_id = e.id AND a.status != 'CANCELLED') AS assigned
           FROM events e
          WHERE e.archived_at IS NULL
            AND e.status IN ('DRAFT','SCHEDULED')
            AND e.starts_at >= ?1
          ORDER BY e.starts_at ASC
          LIMIT 6`
      ).bind(new Date().toISOString()),

      // Events that have happened but still have people neither marked as
      // attended nor as a no-show. This is the queue that quietly rots: the
      // hours are lost to memory within a fortnight, and hours are what a
      // funder asks to see.
      env.DB.prepare(
        `SELECT e.id, e.public_ref, e.title, e.starts_at,
                COUNT(a.id) AS unrecorded
           FROM events e
           JOIN event_assignments a ON a.event_id = e.id
          WHERE e.archived_at IS NULL
            AND e.status != 'CANCELLED'
            AND e.starts_at < ?1
            AND a.status IN ('ASSIGNED','CONFIRMED')
          GROUP BY e.id
          ORDER BY e.starts_at ASC
          LIMIT 10`
      ).bind(new Date().toISOString())
    ]);

    const c = (counts.results && counts.results[0]) || {};
    const ec = (enquiryCounts.results && enquiryCounts.results[0]) || {};
    const failedTotal = (failedMailTotal.results && failedMailTotal.results[0] && failedMailTotal.results[0].total) || 0;

    return adminJson({
      ok: true,
      actor: auth.actor,
      enquiries: {
        unanswered: ec.unanswered || 0,
        awaitingFunds: ec.awaiting_funds || 0,
        failedAcks: ec.failed_acks || 0,
        openTotal: ec.open_total || 0,
        recent: (recentEnquiries.results || []).map((r) => ({
          id: r.id,
          reference: r.public_ref,
          type: r.type,
          name: `${r.first_name} ${r.last_name}`.trim(),
          status: r.status,
          submittedAt: r.created_at,
          amount: r.amount_received || r.amount_declared,
          fundsReceived: !!r.funds_received
        }))
      },
      events: {
        upcoming: (upcomingEvents.results || []).map((r) => ({
          id: r.id,
          reference: r.public_ref,
          title: r.title,
          location: r.location,
          startsAt: r.starts_at,
          capacity: r.capacity,
          assigned: r.assigned || 0,
          status: r.status
        })),
        needsAttendance: (needsAttendance.results || []).map((r) => ({
          id: r.id,
          reference: r.public_ref,
          title: r.title,
          startsAt: r.starts_at,
          unrecorded: r.unrecorded || 0
        }))
      },
      counts: {
        new7d: c.new_7d || 0,
        pendingReview: c.pending_review || 0,
        contacted: c.contacted || 0,
        active: c.active || 0,
        archived: c.archived || 0,
        total: c.total || 0,
        failedEmails: failedTotal
      },
      recent: (recent.results || []).map((r) => ({
        id: r.id,
        reference: r.public_ref,
        name: `${r.first_name} ${r.last_name}`.trim(),
        status: r.status,
        interests: r.interests ? r.interests.split(',') : [],
        submittedAt: r.created_at
      })),
      actionQueue: {
        failedEmailsTotal: failedTotal,
        failedEmails: (failedMail.results || []).map((r) => ({
          kind: r.kind,
          communicationId: r.id,
          type: r.type,
          to: r.to_address,
          attempts: r.attempts,
          error: r.error_message,
          reference: r.reference,
          name: (r.name || '').trim(),
          lastAttemptAt: r.updated_at
        })),
        awaitingReview: (stale.results || []).map((r) => ({
          id: r.id,
          reference: r.public_ref,
          name: `${r.first_name} ${r.last_name}`.trim(),
          submittedAt: r.created_at
        })),
        staleAfterDays: staleDays
      }
    });
  } catch (err) {
    console.error('admin/dashboard failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
