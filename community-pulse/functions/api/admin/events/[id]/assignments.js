/* =========================================================
   POST /api/admin/events/:id/assignments
   ---------------------------------------------------------
   Put one or more volunteers on an event's roster.

   Body:
     volunteer_ids        [1, 2, 3]
     role                 optional, applied to all in this batch
     notify               true to email them
     note                 optional personal line in that email
     allow_over_capacity  true to go past the stated capacity

   Already-assigned volunteers are reported as skipped rather
   than failing the whole batch - assigning eight people and
   being rejected because one was already down would be
   infuriating and would tell you nothing useful.
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../../../_lib/admin-auth.js';
import {
  eventAssignmentEmail,
  deliverCommunication,
  queueVolunteerComm
} from '../../../../_lib/zoho.js';

const MAX_BATCH = 100;

// How many assignment emails are in flight at once. Small enough to stay well
// inside the mail provider's rate limits and the Workers connection budget,
// large enough that a twenty-person roster no longer takes twenty round trips.
const NOTIFY_CONCURRENCY = 5;
const LIMITS = { role: 80, note: 1000 };

export async function onRequestPost(context) {
  const auth = await requireAdmin(context, 'COORDINATOR');
  if (!auth.ok) return denied(auth);

  const { env, request, params } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return adminJson({ ok: false, error: 'invalid_json' }, 400);
  }

  // Controlled list of integers. These go into an IN (...) clause built from
  // placeholders, so nothing attacker-supplied reaches the SQL text itself.
  const ids = Array.isArray(body.volunteer_ids)
    ? [...new Set(body.volunteer_ids.map((n) => parseInt(n, 10)).filter(Number.isInteger))]
    : [];

  if (!ids.length) {
    return adminJson(
      { ok: false, error: 'validation_failed', fields: { volunteer_ids: 'Choose at least one volunteer.' } },
      400
    );
  }
  if (ids.length > MAX_BATCH) {
    return adminJson({ ok: false, error: 'too_many', max: MAX_BATCH }, 400);
  }

  const role = typeof body.role === 'string'
    ? body.role.replace(/\s+/g, ' ').trim().slice(0, LIMITS.role)
    : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, LIMITS.note) : '';
  const wantsNotify = body.notify === true;

  const numeric = /^\d+$/.test(params.id) ? Number(params.id) : null;

  try {
    const event = await env.DB
      .prepare(
        `SELECT * FROM events
          WHERE ${numeric !== null ? 'id = ?' : 'public_ref = ?'} LIMIT 1`
      )
      .bind(numeric !== null ? numeric : params.id)
      .first();

    if (!event) return adminJson({ ok: false, error: 'not_found' }, 404);
    if (event.status === 'CANCELLED') {
      return adminJson({ ok: false, error: 'event_cancelled' }, 409);
    }

    const placeholders = ids.map(() => '?').join(',');

    const [found, existing, countRow] = await env.DB.batch([
      env.DB.prepare(
        `SELECT id, first_name, last_name, email, status, archived_at
           FROM volunteers WHERE id IN (${placeholders})`
      ).bind(...ids),
      env.DB.prepare(
        `SELECT volunteer_id, status FROM event_assignments
          WHERE event_id = ? AND volunteer_id IN (${placeholders})`
      ).bind(event.id, ...ids),
      env.DB.prepare(
        `SELECT COUNT(*) AS n FROM event_assignments
          WHERE event_id = ? AND status != 'CANCELLED'`
      ).bind(event.id)
    ]);

    const volunteers = new Map((found.results || []).map((v) => [v.id, v]));
    const alreadyOn = new Map((existing.results || []).map((r) => [r.volunteer_id, r.status]));
    const currentCount = (countRow.results && countRow.results[0] && countRow.results[0].n) || 0;

    const skipped = [];
    const toAssign = [];

    for (const id of ids) {
      const v = volunteers.get(id);
      if (!v) { skipped.push({ volunteerId: id, reason: 'not_found' }); continue; }
      if (v.archived_at) { skipped.push({ volunteerId: id, reason: 'archived', name: `${v.first_name} ${v.last_name}`.trim() }); continue; }

      const prior = alreadyOn.get(id);
      // A previously cancelled assignment is reinstated rather than
      // duplicated, since the UNIQUE constraint forbids a second row.
      if (prior && prior !== 'CANCELLED') {
        skipped.push({ volunteerId: id, reason: 'already_assigned', name: `${v.first_name} ${v.last_name}`.trim() });
        continue;
      }
      toAssign.push({ volunteer: v, reinstate: prior === 'CANCELLED' });
    }

    if (!toAssign.length) {
      return adminJson({ ok: true, assigned: [], skipped, notified: null });
    }

    if (
      event.capacity !== null &&
      body.allow_over_capacity !== true &&
      currentCount + toAssign.length > event.capacity
    ) {
      return adminJson({
        ok: false,
        error: 'over_capacity',
        capacity: event.capacity,
        assigned: currentCount,
        remaining: Math.max(event.capacity - currentCount, 0),
        requested: toAssign.length
      }, 409);
    }

    const now = new Date().toISOString();

    await env.DB.batch(
      toAssign.map(({ volunteer, reinstate }) =>
        reinstate
          ? env.DB.prepare(
              // notified_at and hours are cleared: this is a fresh assignment
              // that happens to reuse the row. Leaving notified_at meant the
              // roster showed "emailed" for someone re-added without one, so a
              // second coordinator would believe they had been told the details
              // and never contact them.
              `UPDATE event_assignments
                  SET status = 'ASSIGNED', role = ?, hours = NULL, notes = NULL,
                      notified_at = NULL, updated_at = ?, created_by = ?
                WHERE event_id = ? AND volunteer_id = ?`
            ).bind(role || null, now, auth.actor.email, event.id, volunteer.id)
          : env.DB.prepare(
              `INSERT INTO event_assignments
                 (event_id, volunteer_id, role, status, created_by, created_at, updated_at)
               VALUES (?, ?, ?, 'ASSIGNED', ?, ?, ?)`
            ).bind(event.id, volunteer.id, role || null, auth.actor.email, now, now)
      )
    );

    await recordAudit(env, {
      actor: auth.actor.email,
      action: 'EVENT_ASSIGN',
      entityType: 'event',
      entityId: event.id,
      after: { volunteerIds: toAssign.map((t) => t.volunteer.id), role: role || null }
    });

    /* ---------------- optional emails ----------------
       Sent individually so no volunteer sees another's address, and after
       the roster is committed so a mail outage cannot lose an assignment. */
    let notified = null;

    if (wantsNotify) {
      let sent = 0;
      const failures = [];

      /**
       * One volunteer's queue-send-mark sequence. Everything, including
       * building the email, sits inside the try: a template that threw
       * outside it would reject the surrounding batch and fail the whole
       * request, after other volunteers had already been emailed - which
       * invites the admin to retry and send those people a second copy.
       */
      const notifyOne = async ({ volunteer }) => {
        const name = `${volunteer.first_name} ${volunteer.last_name}`.trim();
        try {
          const mail = eventAssignmentEmail({
            firstName: volunteer.first_name,
            event: {
              title: event.title,
              starts_at: event.starts_at,
              ends_at: event.ends_at,
              location: event.location,
              description: event.description
            },
            role,
            note
          });

          const commId = await queueVolunteerComm(env, {
            volunteerId: volunteer.id,
            type: 'EVENT_ASSIGNMENT',
            to: volunteer.email,
            subject: mail.subject,
            preview: note || event.title,
            createdBy: auth.actor.email,
            at: now
          });

          const result = await deliverCommunication(env, commId, {
            to: volunteer.email,
            subject: mail.subject,
            html: mail.html
          });

          if (!result.ok) return { ok: false, name, error: result.error };

          await env.DB
            .prepare('UPDATE event_assignments SET notified_at = ? WHERE event_id = ? AND volunteer_id = ?')
            .bind(now, event.id, volunteer.id)
            .run();
          return { ok: true };
        } catch (mailErr) {
          return {
            ok: false,
            name,
            error: (mailErr && mailErr.message ? mailErr.message : 'unknown').slice(0, 120)
          };
        }
      };

      // Sent a few at a time rather than all at once. Fully sequential made
      // the admin wait one Zoho round trip per person on a large roster;
      // fully concurrent would fire up to MAX_BATCH (100) simultaneous calls
      // at the mail API and the Workers connection limit, and the failure
      // that produces - a rate-limited batch where a dozen volunteers are
      // never told when to turn up - is far worse than the seconds saved.
      const outcomes = [];
      for (let i = 0; i < toAssign.length; i += NOTIFY_CONCURRENCY) {
        const slice = toAssign.slice(i, i + NOTIFY_CONCURRENCY);
        const settled = await Promise.all(slice.map(notifyOne));
        outcomes.push(...settled);
      }

      for (const outcome of outcomes) {
        if (outcome.ok) sent += 1;
        else failures.push({ name: outcome.name, error: outcome.error });
      }

      notified = { sent, attempted: toAssign.length, failures };
    }

    return adminJson({
      ok: true,
      assigned: toAssign.map(({ volunteer, reinstate }) => ({
        volunteerId: volunteer.id,
        name: `${volunteer.first_name} ${volunteer.last_name}`.trim(),
        reinstated: reinstate
      })),
      skipped,
      notified
    }, 201);
  } catch (err) {
    console.error('admin/event assign failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
