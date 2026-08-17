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

    const [counts, recent, failedMail, stale, enquiryCounts, recentEnquiries] = await env.DB.batch([
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
      env.DB.prepare(
        `SELECT c.id, c.type, c.to_address, c.attempts, c.error_message, c.updated_at,
                v.public_ref, v.first_name, v.last_name
           FROM communications c
           JOIN volunteers v ON v.id = c.volunteer_id
          WHERE c.status = 'FAILED'
          ORDER BY c.updated_at DESC
          LIMIT 20`
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
      )
    ]);

    const c = (counts.results && counts.results[0]) || {};
    const ec = (enquiryCounts.results && enquiryCounts.results[0]) || {};

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
      counts: {
        new7d: c.new_7d || 0,
        pendingReview: c.pending_review || 0,
        contacted: c.contacted || 0,
        active: c.active || 0,
        archived: c.archived || 0,
        total: c.total || 0,
        failedEmails: (failedMail.results || []).length
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
        failedEmails: (failedMail.results || []).map((r) => ({
          communicationId: r.id,
          type: r.type,
          to: r.to_address,
          attempts: r.attempts,
          error: r.error_message,
          reference: r.public_ref,
          name: `${r.first_name} ${r.last_name}`.trim(),
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
