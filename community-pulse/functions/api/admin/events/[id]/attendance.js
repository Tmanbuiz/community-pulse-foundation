/* =========================================================
   POST /api/admin/events/:id/attendance
   ---------------------------------------------------------
   Record who turned up and how long they stayed. Sent as one
   batch for the whole roster, because that is how the work
   actually happens: you sit down after an event and go through
   the list once.

   Body:
     entries: [{ assignment_id, status, hours, role, notes }]

   Nothing is emailed from here. Telling a volunteer "we have
   recorded that you attended" is administrative noise, and
   hours are our record rather than a claim about them.
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../../../_lib/admin-auth.js';

const STATUSES = new Set(['ASSIGNED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED']);
const MAX_ENTRIES = 200;
const LIMITS = { role: 80, notes: 500 };

/** Hours: blank clears the value, otherwise 0-24 with at most two decimals. */
function parseHours(raw) {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 24) return { ok: false };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

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

  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (!entries.length) {
    return adminJson(
      { ok: false, error: 'validation_failed', fields: { entries: 'Nothing to record.' } },
      400
    );
  }
  if (entries.length > MAX_ENTRIES) {
    return adminJson({ ok: false, error: 'too_many', max: MAX_ENTRIES }, 400);
  }

  const numeric = /^\d+$/.test(params.id) ? Number(params.id) : null;

  try {
    const event = await env.DB
      .prepare(
        `SELECT id, public_ref, title, status FROM events
          WHERE ${numeric !== null ? 'id = ?' : 'public_ref = ?'} LIMIT 1`
      )
      .bind(numeric !== null ? numeric : params.id)
      .first();

    if (!event) return adminJson({ ok: false, error: 'not_found' }, 404);

    // Every assignment id is checked against this event. Without that, an
    // admin holding a valid id from another event could write to it through
    // this route.
    const owned = await env.DB
      .prepare('SELECT id FROM event_assignments WHERE event_id = ?')
      .bind(event.id)
      .all();

    const ownedIds = new Set((owned.results || []).map((r) => r.id));

    const statements = [];
    const rejected = [];
    const hoursDropped = [];
    let applied = 0;
    const now = new Date().toISOString();

    for (const entry of entries) {
      const id = parseInt(entry.assignment_id, 10);
      if (!Number.isInteger(id) || !ownedIds.has(id)) {
        rejected.push({ assignmentId: entry.assignment_id, reason: 'not_on_this_event' });
        continue;
      }

      const status = String(entry.status || '').toUpperCase();
      if (!STATUSES.has(status)) {
        rejected.push({ assignmentId: id, reason: 'invalid_status' });
        continue;
      }

      const hours = parseHours(entry.hours);
      if (!hours.ok) {
        rejected.push({ assignmentId: id, reason: 'invalid_hours' });
        continue;
      }

      // Hours against someone who did not turn up would corrupt any total
      // reported to a funder, so they are never written - but the status
      // change is applied regardless, and the drop is reported back rather
      // than the whole row being refused. Rejecting the row outright used to
      // mean a correction *away* from ATTENDED (the exact fix this file needs
      // to make) silently failed whenever it arrived with a leftover hours
      // value, because the status change never got the chance to apply.
      let hoursValue = hours.value;
      if (hoursValue !== null && status !== 'ATTENDED') {
        hoursValue = null;
        hoursDropped.push({ assignmentId: id });
      }

      // Only columns the caller actually sent are written. Writing every
      // column unconditionally meant an omitted field was silently set to
      // NULL: the interface never sends `notes`, so every routine attendance
      // save wiped any note stored against that helper.
      const sets = ['status = ?', 'hours = ?'];
      const binds = [status, hoursValue];

      if (entry.role !== undefined) {
        sets.push('role = ?');
        binds.push(
          typeof entry.role === 'string'
            ? entry.role.replace(/\s+/g, ' ').trim().slice(0, LIMITS.role) || null
            : null
        );
      }

      if (entry.notes !== undefined) {
        sets.push('notes = ?');
        binds.push(
          typeof entry.notes === 'string'
            ? entry.notes.replace(/\r\n/g, '\n').trim().slice(0, LIMITS.notes) || null
            : null
        );
      }

      sets.push('updated_at = ?');
      binds.push(now, id, event.id);

      statements.push(
        env.DB.prepare(
          `UPDATE event_assignments SET ${sets.join(', ')} WHERE id = ? AND event_id = ?`
        ).bind(...binds)
      );
      applied += 1;
    }

    if (!statements.length) {
      return adminJson({ ok: false, error: 'nothing_applied', rejected }, 400);
    }

    await env.DB.batch(statements);

    const totals = await env.DB
      .prepare(
        `SELECT COUNT(*) AS roster,
                SUM(CASE WHEN status = 'ATTENDED' THEN 1 ELSE 0 END) AS attended,
                SUM(CASE WHEN status = 'NO_SHOW'  THEN 1 ELSE 0 END) AS no_show,
                COALESCE(SUM(hours), 0) AS total_hours
           FROM event_assignments
          WHERE event_id = ? AND status != 'CANCELLED'`
      )
      .bind(event.id)
      .first();

    await recordAudit(env, {
      actor: auth.actor.email,
      action: 'EVENT_ATTENDANCE',
      entityType: 'event',
      entityId: event.id,
      after: {
        applied,
        rejected: rejected.length,
        hoursDropped: hoursDropped.length,
        attended: (totals && totals.attended) || 0,
        totalHours: (totals && totals.total_hours) || 0
      }
    });

    return adminJson({
      ok: true,
      applied,
      rejected,
      hoursDropped,
      totals: {
        roster: (totals && totals.roster) || 0,
        attended: (totals && totals.attended) || 0,
        noShow: (totals && totals.no_show) || 0,
        totalHours: (totals && totals.total_hours) || 0
      }
    });
  } catch (err) {
    console.error('admin/event attendance failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
