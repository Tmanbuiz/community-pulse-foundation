/* =========================================================
   GET  /api/admin/events   list and filter
   POST /api/admin/events   create

   Query parameters (all optional):
     q         free text across title, location, reference
     status    DRAFT | SCHEDULED | COMPLETED | CANCELLED
     when      "upcoming" | "past"
     archived  "1" to include archived
     page, limit, sort
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../../_lib/admin-auth.js';

const STATUSES = new Set(['DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED']);

const SORTS = {
  soonest: 'e.starts_at ASC',
  latest: 'e.starts_at DESC',
  created: 'e.created_at DESC',
  title: 'e.title ASC'
};

const LIMITS = { title: 140, location: 200, description: 2000, role: 80 };

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Requires an unambiguous instant: an ISO timestamp carrying Z or an offset.
 *
 * A bare "2026-08-20T14:00" from a datetime-local input is deliberately
 * rejected. The server has no way to know which zone the admin meant, and
 * guessing UTC would shift every event by three hours in Atlantic Canada -
 * an admin types 2pm, the volunteer is told 11am, and nobody notices until
 * somebody turns up to an empty hall. The browser converts before sending.
 */
function parseWhen(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(value.trim())) return null;
  const d = new Date(value.trim());
  return isNaN(d) ? null : d.toISOString();
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context, 'VIEWER');
  if (!auth.ok) return denied(auth);

  const { env, request } = context;
  const p = new URL(request.url).searchParams;

  const where = [];
  const binds = [];

  if (p.get('archived') !== '1') where.push('e.archived_at IS NULL');

  const status = (p.get('status') || '').toUpperCase();
  if (status && STATUSES.has(status)) {
    where.push('e.status = ?');
    binds.push(status);
  }

  const when = p.get('when');
  if (when === 'upcoming') {
    where.push('e.starts_at >= ?');
    binds.push(new Date().toISOString());
  } else if (when === 'past') {
    where.push('e.starts_at < ?');
    binds.push(new Date().toISOString());
  }

  const q = (p.get('q') || '').trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (ch) => '\\' + ch)}%`;
    where.push(`(
      e.title      LIKE ? ESCAPE '\\' OR
      e.location   LIKE ? ESCAPE '\\' OR
      e.public_ref LIKE ? ESCAPE '\\'
    )`);
    binds.push(like, like, like);
  }

  const limit = Math.min(Math.max(parseInt(p.get('limit'), 10) || 25, 1), 100);
  const page = Math.max(parseInt(p.get('page'), 10) || 1, 1);
  const offset = (page - 1) * limit;
  const orderBy = SORTS[p.get('sort')] || (when === 'past' ? SORTS.latest : SORTS.soonest);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    // Independent statements against the same WHERE clause, combined into
    // one round trip rather than two sequential ones.
    //
    // Assignment tallies come from correlated subqueries rather than a JOIN
    // with GROUP BY: the counts are per-status and a single grouped join
    // cannot produce them without either several passes or a pivot.
    //
    // total_hours is filtered to ATTENDED, matching the volunteer profile's
    // total exactly. It previously summed every row's `hours` regardless of
    // status; that happened to agree with the filtered total only because
    // attendance.js is currently the sole writer of non-null hours and
    // enforces the same rule at insert time - an implicit invariant, not a
    // guaranteed one. Filtering here too means the two screens can never
    // show two different totals for the same event, regardless of how a
    // future write path (a direct DB correction, a bulk import) behaves.
    const [countResult, rows] = await env.DB.batch([
      env.DB.prepare(`SELECT COUNT(*) AS n FROM events e ${whereSql}`).bind(...binds),
      env.DB.prepare(
        `SELECT e.id, e.public_ref, e.title, e.location, e.starts_at, e.ends_at,
                e.capacity, e.status, e.archived_at,
                (SELECT COUNT(*) FROM event_assignments a
                  WHERE a.event_id = e.id AND a.status != 'CANCELLED') AS assigned,
                (SELECT COUNT(*) FROM event_assignments a
                  WHERE a.event_id = e.id AND a.status = 'ATTENDED') AS attended,
                (SELECT COALESCE(SUM(a.hours), 0) FROM event_assignments a
                  WHERE a.event_id = e.id AND a.status = 'ATTENDED') AS total_hours
           FROM events e
           ${whereSql}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`
      ).bind(...binds, limit, offset)
    ]);

    const countRow = (countResult.results && countResult.results[0]) || {};
    const total = countRow.n || 0;

    return adminJson({
      ok: true,
      actor: auth.actor,
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
      results: (rows.results || []).map((r) => ({
        id: r.id,
        reference: r.public_ref,
        title: r.title,
        location: r.location,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        capacity: r.capacity,
        status: r.status,
        archived: !!r.archived_at,
        assigned: r.assigned || 0,
        attended: r.attended || 0,
        totalHours: r.total_hours || 0
      }))
    });
  } catch (err) {
    console.error('admin/events list failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context, 'COORDINATOR');
  if (!auth.ok) return denied(auth);

  const { env, request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return adminJson({ ok: false, error: 'invalid_json' }, 400);
  }

  const errors = {};

  const title = clean(body.title, LIMITS.title);
  if (title.length < 3) errors.title = 'Please give the event a name.';

  const startsAt = parseWhen(body.starts_at);
  if (!startsAt) errors.starts_at = 'Please give a start date and time.';

  const endsAt = parseWhen(body.ends_at);
  if (body.ends_at && !endsAt) {
    errors.ends_at = 'That finish time could not be read.';
  } else if (startsAt && endsAt && endsAt <= startsAt) {
    errors.ends_at = 'The finish time must be after the start time.';
  }

  let capacity = null;
  if (body.capacity !== undefined && body.capacity !== null && body.capacity !== '') {
    capacity = parseInt(body.capacity, 10);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
      errors.capacity = 'Capacity should be a whole number, or left blank for no limit.';
    }
  }

  const status = String(body.status || 'DRAFT').toUpperCase();
  if (!STATUSES.has(status)) errors.status = 'Unknown status.';

  if (Object.keys(errors).length) {
    return adminJson({ ok: false, error: 'validation_failed', fields: errors }, 400);
  }

  const location = clean(body.location, LIMITS.location);
  const description =
    typeof body.description === 'string'
      ? body.description.replace(/\r\n/g, '\n').trim().slice(0, LIMITS.description)
      : '';

  const now = new Date().toISOString();

  try {
    const inserted = await env.DB
      .prepare(
        `INSERT INTO events
           (title, description, location, starts_at, ends_at, capacity, status,
            created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        title,
        description || null,
        location || null,
        startsAt,
        endsAt,
        capacity,
        status,
        auth.actor.email,
        now,
        now
      )
      .run();

    const id = inserted.meta && inserted.meta.last_row_id;
    if (!id) throw new Error('insert returned no row id');

    const publicRef = `CPF-EVT-${new Date(startsAt).getUTCFullYear()}-${String(id).padStart(6, '0')}`;

    await env.DB
      .prepare('UPDATE events SET public_ref = ? WHERE id = ?')
      .bind(publicRef, id)
      .run();

    await recordAudit(env, {
      actor: auth.actor.email,
      action: 'EVENT_CREATE',
      entityType: 'event',
      entityId: id,
      after: { public_ref: publicRef, title, starts_at: startsAt, status }
    });

    return adminJson({ ok: true, event: { id, reference: publicRef, title, status } }, 201);
  } catch (err) {
    console.error('admin/events create failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
