/* =========================================================
   GET /api/admin/volunteers
   ---------------------------------------------------------
   Search, filter and paginate the volunteer directory.

   Query parameters (all optional, all combinable):
     q            free text across name, email, phone, reference
     status       NEW | REVIEWED | CONTACTED | APPROVED | ACTIVE |
                  INACTIVE | DECLINED | ARCHIVED
     interest     controlled interest code
     availability controlled availability code
     from, to     ISO dates against created_at
     contact      "never" | "contacted"
     archived     "1" to include archived records
     page, limit  pagination (limit capped at 100)

   Never returns accommodation_text. That field is restricted to
   the individual profile view, so it cannot leak through a list,
   a filter or an accidental screenshot of the directory.
   ========================================================= */

import { requireAdmin, adminJson, denied } from '../../../_lib/admin-auth.js';

const STATUSES = new Set([
  'NEW', 'REVIEWED', 'CONTACTED', 'APPROVED',
  'ACTIVE', 'INACTIVE', 'DECLINED', 'ARCHIVED'
]);

const INTERESTS = new Set([
  'community_events', 'packaging_sorting', 'transport_support',
  'outreach_awareness', 'general_support', 'other'
]);

const AVAILABILITY = new Set([
  'weekday', 'evening', 'weekend', 'flexible', 'event_based', 'other'
]);

// Only allow sorting by columns we actually index, and never interpolate
// user input into the ORDER BY clause.
const SORTS = {
  newest: 'v.created_at DESC',
  oldest: 'v.created_at ASC',
  name: 'v.last_name ASC, v.first_name ASC',
  status: 'v.status ASC, v.created_at DESC'
};

export async function onRequestGet(context) {
  const auth = await requireAdmin(context, 'VIEWER');
  if (!auth.ok) return denied(auth);

  const { env, request } = context;
  const url = new URL(request.url);
  const p = url.searchParams;

  const where = [];
  const binds = [];

  // Archived records are hidden unless explicitly asked for, so the default
  // directory reflects live workload rather than history.
  if (p.get('archived') !== '1') {
    where.push('v.archived_at IS NULL');
  }

  const status = (p.get('status') || '').toUpperCase();
  if (status && STATUSES.has(status)) {
    where.push('v.status = ?');
    binds.push(status);
  }

  const interest = p.get('interest');
  if (interest && INTERESTS.has(interest)) {
    where.push('EXISTS (SELECT 1 FROM volunteer_interests i WHERE i.volunteer_id = v.id AND i.interest_code = ?)');
    binds.push(interest);
  }

  const availability = p.get('availability');
  if (availability && AVAILABILITY.has(availability)) {
    where.push('EXISTS (SELECT 1 FROM volunteer_availability a WHERE a.volunteer_id = v.id AND a.availability_code = ?)');
    binds.push(availability);
  }

  const from = p.get('from');
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where.push('v.created_at >= ?');
    binds.push(`${from}T00:00:00.000Z`);
  }

  const to = p.get('to');
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where.push('v.created_at <= ?');
    binds.push(`${to}T23:59:59.999Z`);
  }

  const contact = p.get('contact');
  if (contact === 'never') where.push('v.last_contact_at IS NULL');
  if (contact === 'contacted') where.push('v.last_contact_at IS NOT NULL');

  const q = (p.get('q') || '').trim();
  if (q) {
    // LIKE with bound parameters — the wildcards are added to the value,
    // never to the SQL string.
    // % and _ are wildcards in LIKE, so a search for "50%" would otherwise
    // match far more than intended. Escape them in the value and declare
    // the escape character to SQLite.
    const like = `%${q.replace(/[%_\\]/g, (ch) => '\\' + ch)}%`;
    where.push(`(
      v.first_name LIKE ? ESCAPE '\\' OR
      v.last_name  LIKE ? ESCAPE '\\' OR
      (v.first_name || ' ' || v.last_name) LIKE ? ESCAPE '\\' OR
      v.email      LIKE ? ESCAPE '\\' OR
      v.phone      LIKE ? ESCAPE '\\' OR
      v.public_ref LIKE ? ESCAPE '\\'
    )`);
    binds.push(like, like, like, like, like, like);
  }

  const limit = Math.min(Math.max(parseInt(p.get('limit'), 10) || 25, 1), 100);
  const page = Math.max(parseInt(p.get('page'), 10) || 1, 1);
  const offset = (page - 1) * limit;

  const orderBy = SORTS[p.get('sort')] || SORTS.newest;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const countRow = await env.DB
      .prepare(`SELECT COUNT(*) AS n FROM volunteers v ${whereSql}`)
      .bind(...binds)
      .first();

    const rows = await env.DB
      .prepare(
        `SELECT v.id, v.public_ref, v.first_name, v.last_name, v.email, v.phone,
                v.status, v.created_at, v.last_contact_at, v.archived_at,
                (SELECT group_concat(interest_code)
                   FROM volunteer_interests WHERE volunteer_id = v.id) AS interests,
                (SELECT group_concat(availability_code)
                   FROM volunteer_availability WHERE volunteer_id = v.id) AS availability
           FROM volunteers v
           ${whereSql}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`
      )
      .bind(...binds, limit, offset)
      .all();

    const total = (countRow && countRow.n) || 0;

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
        firstName: r.first_name,
        lastName: r.last_name,
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: r.email,
        phone: r.phone,
        status: r.status,
        interests: r.interests ? r.interests.split(',') : [],
        availability: r.availability ? r.availability.split(',') : [],
        submittedAt: r.created_at,
        lastContactAt: r.last_contact_at,
        archived: !!r.archived_at
      }))
    });
  } catch (err) {
    console.error('admin/volunteers list failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
