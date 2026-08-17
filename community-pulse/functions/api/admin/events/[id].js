/* =========================================================
   GET   /api/admin/events/:id   event with its roster
   PATCH /api/admin/events/:id   details, status, archive

   :id accepts the numeric id or the public reference.

   Cancelling an event can email everyone still on the roster.
   That is opt-in like every other outgoing message, but it is
   the one case where sending is almost always right: somebody
   who turns up to a cancelled event has given up an afternoon
   for nothing.
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../../_lib/admin-auth.js';
import { eventCancelledEmail, sendMail } from '../../../_lib/zoho.js';

const STATUSES = ['DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];
const LIMITS = { title: 140, location: 200, description: 2000, note: 1000 };

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseWhen(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value.length === 16 ? `${value}:00Z` : value);
  return isNaN(d) ? null : d.toISOString();
}

async function loadEvent(env, idParam) {
  const numeric = /^\d+$/.test(idParam) ? Number(idParam) : null;
  return env.DB
    .prepare(
      `SELECT * FROM events
        WHERE ${numeric !== null ? 'id = ?' : 'public_ref = ?'} LIMIT 1`
    )
    .bind(numeric !== null ? numeric : idParam)
    .first();
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context, 'VIEWER');
  if (!auth.ok) return denied(auth);

  const { env, params } = context;

  try {
    const e = await loadEvent(env, params.id);
    if (!e) return adminJson({ ok: false, error: 'not_found' }, 404);

    const [roster, activity] = await env.DB.batch([
      env.DB.prepare(
        `SELECT a.id, a.volunteer_id, a.role, a.status, a.hours, a.notes,
                a.notified_at, a.created_by, a.created_at,
                v.public_ref, v.first_name, v.last_name, v.email, v.phone
           FROM event_assignments a
           JOIN volunteers v ON v.id = a.volunteer_id
          WHERE a.event_id = ?
          ORDER BY v.last_name ASC, v.first_name ASC`
      ).bind(e.id),
      env.DB.prepare(
        `SELECT actor, action, before_json, after_json, created_at
           FROM audit_log
          WHERE entity_type = 'event' AND entity_id = ?
          ORDER BY created_at DESC LIMIT 50`
      ).bind(String(e.id))
    ]);

    const rows = roster.results || [];

    return adminJson({
      ok: true,
      actor: auth.actor,
      event: {
        id: e.id,
        reference: e.public_ref,
        title: e.title,
        description: e.description,
        location: e.location,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        capacity: e.capacity,
        status: e.status,
        createdBy: e.created_by,
        createdAt: e.created_at,
        archivedAt: e.archived_at,
        assignedCount: rows.filter((r) => r.status !== 'CANCELLED').length,
        attendedCount: rows.filter((r) => r.status === 'ATTENDED').length,
        totalHours: rows.reduce((sum, r) => sum + (r.hours || 0), 0)
      },
      roster: rows.map((r) => ({
        assignmentId: r.id,
        volunteerId: r.volunteer_id,
        reference: r.public_ref,
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: r.email,
        phone: r.phone,
        role: r.role,
        status: r.status,
        hours: r.hours,
        notes: r.notes,
        notifiedAt: r.notified_at,
        addedBy: r.created_by,
        addedAt: r.created_at
      })),
      activity: (activity.results || []).map((a) => ({
        actor: a.actor,
        action: a.action,
        at: a.created_at,
        before: a.before_json ? JSON.parse(a.before_json) : null,
        after: a.after_json ? JSON.parse(a.after_json) : null
      }))
    });
  } catch (err) {
    console.error('admin/event detail failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}

export async function onRequestPatch(context) {
  const auth = await requireAdmin(context, 'COORDINATOR');
  if (!auth.ok) return denied(auth);

  const { env, request, params } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return adminJson({ ok: false, error: 'invalid_json' }, 400);
  }

  try {
    const e = await loadEvent(env, params.id);
    if (!e) return adminJson({ ok: false, error: 'not_found' }, 404);

    const sets = [];
    const binds = [];
    const before = {};
    const after = {};
    const errors = {};

    if (body.title !== undefined) {
      const title = clean(body.title, LIMITS.title);
      if (title.length < 3) errors.title = 'Please give the event a name.';
      else if (title !== e.title) {
        sets.push('title = ?'); binds.push(title);
        before.title = e.title; after.title = title;
      }
    }

    if (body.location !== undefined) {
      const location = clean(body.location, LIMITS.location);
      if ((location || null) !== e.location) {
        sets.push('location = ?'); binds.push(location || null);
        before.location = e.location; after.location = location || null;
      }
    }

    if (body.description !== undefined) {
      const description = typeof body.description === 'string'
        ? body.description.replace(/\r\n/g, '\n').trim().slice(0, LIMITS.description)
        : '';
      if ((description || null) !== e.description) {
        sets.push('description = ?'); binds.push(description || null);
        after.description = 'changed';
      }
    }

    // Start and finish are validated as a pair, against whichever value is
    // not being changed, so editing only one cannot produce a negative shift.
    let nextStart = e.starts_at;
    let nextEnd = e.ends_at;

    if (body.starts_at !== undefined) {
      const startsAt = parseWhen(body.starts_at);
      if (!startsAt) errors.starts_at = 'That start time could not be read.';
      else nextStart = startsAt;
    }

    if (body.ends_at !== undefined) {
      if (body.ends_at === '' || body.ends_at === null) nextEnd = null;
      else {
        const endsAt = parseWhen(body.ends_at);
        if (!endsAt) errors.ends_at = 'That finish time could not be read.';
        else nextEnd = endsAt;
      }
    }

    if (!errors.starts_at && !errors.ends_at && nextEnd && nextEnd <= nextStart) {
      errors.ends_at = 'The finish time must be after the start time.';
    }

    if (!errors.starts_at && nextStart !== e.starts_at) {
      sets.push('starts_at = ?'); binds.push(nextStart);
      before.starts_at = e.starts_at; after.starts_at = nextStart;
    }
    if (!errors.ends_at && nextEnd !== e.ends_at) {
      sets.push('ends_at = ?'); binds.push(nextEnd);
      before.ends_at = e.ends_at; after.ends_at = nextEnd;
    }

    if (body.capacity !== undefined) {
      let capacity = null;
      if (body.capacity !== null && body.capacity !== '') {
        capacity = parseInt(body.capacity, 10);
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
          errors.capacity = 'Capacity should be a whole number, or left blank.';
          capacity = e.capacity;
        }
      }
      if (!errors.capacity && capacity !== e.capacity) {
        sets.push('capacity = ?'); binds.push(capacity);
        before.capacity = e.capacity; after.capacity = capacity;
      }
    }

    if (body.status !== undefined) {
      const next = String(body.status).toUpperCase();
      if (!STATUSES.includes(next)) errors.status = 'Unknown status.';
      else if (next !== e.status) {
        sets.push('status = ?'); binds.push(next);
        before.status = e.status; after.status = next;
      }
    }

    if (body.archived !== undefined) {
      const shouldArchive = body.archived === true;
      if (shouldArchive !== !!e.archived_at) {
        sets.push('archived_at = ?');
        binds.push(shouldArchive ? new Date().toISOString() : null);
        before.archived = !!e.archived_at; after.archived = shouldArchive;
      }
    }

    if (Object.keys(errors).length) {
      return adminJson({ ok: false, error: 'validation_failed', fields: errors }, 400);
    }

    if (!sets.length) return adminJson({ ok: true, unchanged: true });

    const now = new Date().toISOString();
    sets.push('updated_at = ?');
    binds.push(now, e.id);

    await env.DB
      .prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...binds)
      .run();

    await recordAudit(env, {
      actor: auth.actor.email,
      action: after.status ? 'EVENT_STATUS_CHANGE' : 'EVENT_UPDATE',
      entityType: 'event',
      entityId: e.id,
      before,
      after
    });

    /* ---------------- cancellation notices ---------------- */
    let notified = null;

    if (after.status === 'CANCELLED' && body.notify === true) {
      const note = typeof body.note === 'string'
        ? body.note.trim().slice(0, LIMITS.note)
        : '';

      const people = await env.DB
        .prepare(
          `SELECT v.first_name, v.email
             FROM event_assignments a
             JOIN volunteers v ON v.id = a.volunteer_id
            WHERE a.event_id = ? AND a.status != 'CANCELLED'`
        )
        .bind(e.id)
        .all();

      const recipients = people.results || [];
      let sent = 0;
      const failures = [];

      // Sent one at a time rather than as a single message with many
      // recipients: volunteers must never see each other's addresses.
      for (const person of recipients) {
        const mail = eventCancelledEmail({
          firstName: person.first_name,
          event: { title: e.title, starts_at: e.starts_at, ends_at: e.ends_at },
          note
        });
        try {
          await sendMail(env, { to: person.email, subject: mail.subject, html: mail.html });
          sent += 1;
        } catch (mailErr) {
          failures.push((mailErr && mailErr.message ? mailErr.message : 'unknown').slice(0, 120));
        }
      }

      notified = { sent, attempted: recipients.length, failures };

      await recordAudit(env, {
        actor: auth.actor.email,
        action: 'EVENT_CANCEL_NOTICE',
        entityType: 'event',
        entityId: e.id,
        after: { sent, attempted: recipients.length }
      });
    }

    const updated = await loadEvent(env, String(e.id));

    return adminJson({
      ok: true,
      notified,
      event: {
        id: updated.id,
        reference: updated.public_ref,
        title: updated.title,
        status: updated.status,
        startsAt: updated.starts_at,
        endsAt: updated.ends_at,
        archivedAt: updated.archived_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (err) {
    console.error('admin/event patch failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
