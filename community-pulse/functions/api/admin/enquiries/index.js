/* =========================================================
   GET /api/admin/enquiries
   ---------------------------------------------------------
   Search, filter and paginate everything that is not a
   volunteer application.

   Query parameters (all optional, all combinable):
     q         free text across name, email, phone, reference
     type      ITEM_DONATION | FINANCIAL | QUESTION | OTHER
     status    NEW | REVIEWED | RESPONDED | CLOSED | ARCHIVED
     funds     "awaiting" | "received"  (financial only)
     from, to  ISO dates against created_at
     archived  "1" to include archived
     page, limit
   ========================================================= */

import { requireAdmin, adminJson, denied } from '../../../_lib/admin-auth.js';

const TYPES = new Set(['ITEM_DONATION', 'FINANCIAL', 'QUESTION', 'OTHER']);
const STATUSES = new Set(['NEW', 'REVIEWED', 'RESPONDED', 'CLOSED', 'ARCHIVED']);

const SORTS = {
  newest: 'e.created_at DESC',
  oldest: 'e.created_at ASC',
  name: 'e.last_name ASC, e.first_name ASC',
  type: 'e.type ASC, e.created_at DESC'
};

export async function onRequestGet(context) {
  const auth = await requireAdmin(context, 'VIEWER');
  if (!auth.ok) return denied(auth);

  const { env, request } = context;
  const p = new URL(request.url).searchParams;

  const where = [];
  const binds = [];

  if (p.get('archived') !== '1') where.push('e.archived_at IS NULL');

  const type = (p.get('type') || '').toUpperCase();
  if (type && TYPES.has(type)) {
    where.push('e.type = ?');
    binds.push(type);
  }

  const status = (p.get('status') || '').toUpperCase();
  if (status && STATUSES.has(status)) {
    where.push('e.status = ?');
    binds.push(status);
  }

  // Money still owed to the record, so to speak: pledged but not confirmed.
  const funds = p.get('funds');
  if (funds === 'awaiting') where.push("e.type = 'FINANCIAL' AND e.funds_received = 0");
  if (funds === 'received') where.push("e.type = 'FINANCIAL' AND e.funds_received = 1");

  const from = p.get('from');
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where.push('e.created_at >= ?');
    binds.push(`${from}T00:00:00.000Z`);
  }

  const to = p.get('to');
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where.push('e.created_at <= ?');
    binds.push(`${to}T23:59:59.999Z`);
  }

  const q = (p.get('q') || '').trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (ch) => '\\' + ch)}%`;
    where.push(`(
      e.first_name LIKE ? ESCAPE '\\' OR
      e.last_name  LIKE ? ESCAPE '\\' OR
      (e.first_name || ' ' || e.last_name) LIKE ? ESCAPE '\\' OR
      e.email      LIKE ? ESCAPE '\\' OR
      e.phone      LIKE ? ESCAPE '\\' OR
      e.public_ref LIKE ? ESCAPE '\\'
    )`);
    binds.push(like, like, like, like, like, like);
  }

  const limit = Math.min(Math.max(parseInt(p.get('limit'), 10) || 25, 1), 100);
  const page = Math.max(parseInt(p.get('page'), 10) || 1, 1);
  const offset = (page - 1) * limit;
  const orderBy = SORTS[p.get('sort')] || SORTS.newest;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    // Independent statements against the same WHERE clause, combined into
    // one round trip rather than two sequential ones.
    const [countResult, rows] = await env.DB.batch([
      env.DB.prepare(`SELECT COUNT(*) AS n FROM enquiries e ${whereSql}`).bind(...binds),
      env.DB.prepare(
        `SELECT e.id, e.public_ref, e.type, e.first_name, e.last_name, e.email,
                e.phone, e.status, e.created_at, e.last_contact_at, e.archived_at,
                e.amount_declared, e.amount_received, e.funds_received,
                e.ack_status
           FROM enquiries e
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
        type: r.type,
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: r.email,
        phone: r.phone,
        status: r.status,
        submittedAt: r.created_at,
        lastContactAt: r.last_contact_at,
        archived: !!r.archived_at,
        amountDeclared: r.amount_declared,
        amountReceived: r.amount_received,
        fundsReceived: !!r.funds_received,
        ackStatus: r.ack_status
      }))
    });
  } catch (err) {
    console.error('admin/enquiries list failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
