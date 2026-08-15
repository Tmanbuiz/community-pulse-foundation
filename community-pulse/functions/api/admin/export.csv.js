/* =========================================================
   GET /api/admin/export.csv
   ---------------------------------------------------------
   Privacy-controlled export.

   Two safeguards worth being explicit about:

   1. accommodation_text is never included. It is restricted to
      the profile view, and a spreadsheet is exactly the kind of
      thing that gets emailed around.

   2. Cells are sanitised against spreadsheet formula injection.
      A volunteer who types =HYPERLINK(...) into a free-text
      field would otherwise have that execute when an admin
      opens the file in Excel or Sheets.

   Every export writes an audit row naming who did it and how
   many records they took.
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../_lib/admin-auth.js';

const MAX_ROWS = 5000;

/**
 * Escape one CSV cell.
 *
 * Leading =, +, -, @, tab and CR are what spreadsheet apps treat as the
 * start of a formula. Prefixing with an apostrophe forces them to be read
 * as text. This has to happen before quoting, not after.
 */
function csvCell(value) {
  if (value == null) return '""';

  let s = String(value);

  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }

  return `"${s.replace(/"/g, '""')}"`;
}

export async function onRequestGet(context) {
  // Exporting takes personal data out of the system entirely, so it needs
  // more than the ability to read a single record on screen.
  const auth = await requireAdmin(context, 'ADMIN');
  if (!auth.ok) return denied(auth);

  const { env, request } = context;
  const p = new URL(request.url).searchParams;

  const where = [];
  const binds = [];

  if (p.get('archived') !== '1') where.push('v.archived_at IS NULL');

  const status = (p.get('status') || '').toUpperCase();
  if (status) {
    where.push('v.status = ?');
    binds.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const rows = await env.DB
      .prepare(
        `SELECT v.public_ref, v.first_name, v.last_name, v.email, v.phone,
                v.status, v.created_at, v.last_contact_at, v.updates_consent,
                v.privacy_consent_version, v.privacy_consent_at,
                (SELECT group_concat(interest_code)
                   FROM volunteer_interests WHERE volunteer_id = v.id) AS interests,
                (SELECT group_concat(availability_code)
                   FROM volunteer_availability WHERE volunteer_id = v.id) AS availability,
                v.skills_text
           FROM volunteers v
           ${whereSql}
          ORDER BY v.created_at DESC
          LIMIT ${MAX_ROWS}`
      )
      .bind(...binds)
      .all();

    const results = rows.results || [];

    const header = [
      'Reference', 'First name', 'Last name', 'Email', 'Phone',
      'Status', 'Submitted', 'Last contact', 'Interests', 'Availability',
      'Skills', 'Updates consent', 'Consent version', 'Consent date'
    ];

    const lines = [header.map(csvCell).join(',')];

    for (const r of results) {
      lines.push([
        r.public_ref,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.status,
        r.created_at,
        r.last_contact_at,
        r.interests ? r.interests.split(',').join(' | ') : '',
        r.availability ? r.availability.split(',').join(' | ') : '',
        r.skills_text,
        r.updates_consent ? 'yes' : 'no',
        r.privacy_consent_version,
        r.privacy_consent_at
      ].map(csvCell).join(','));
    }

    await recordAudit(env, {
      actor: auth.actor.email,
      action: 'EXPORT',
      entityType: 'volunteer',
      entityId: null,
      after: { rows: results.length, status: status || 'all', includedArchived: p.get('archived') === '1' }
    });

    const stamp = new Date().toISOString().slice(0, 10);

    // BOM so Excel opens UTF-8 names correctly instead of mangling accents.
    return new Response('﻿' + lines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="volunteers-${stamp}.csv"`,
        'Cache-Control': 'no-store, private'
      }
    });
  } catch (err) {
    console.error('admin/export failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
