/* =========================================================
   POST /api/admin/enquiries/:id/notes
   ---------------------------------------------------------
   Same rules as volunteer notes: attributed to the signed-in
   admin, and not editable afterwards.
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../../../_lib/admin-auth.js';

const MAX_NOTE = 2000;

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

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!note) {
    return adminJson({ ok: false, error: 'validation_failed', fields: { note: 'Please enter a note.' } }, 400);
  }
  if (note.length > MAX_NOTE) {
    return adminJson(
      { ok: false, error: 'validation_failed', fields: { note: `Notes are limited to ${MAX_NOTE} characters.` } },
      400
    );
  }

  try {
    const numeric = /^\d+$/.test(params.id) ? Number(params.id) : null;
    const e = await env.DB
      .prepare(
        `SELECT id, public_ref FROM enquiries
          WHERE ${numeric !== null ? 'id = ?' : 'public_ref = ?'} LIMIT 1`
      )
      .bind(numeric !== null ? numeric : params.id)
      .first();

    if (!e) return adminJson({ ok: false, error: 'not_found' }, 404);

    const now = new Date().toISOString();

    const inserted = await env.DB
      .prepare(
        `INSERT INTO enquiry_notes (enquiry_id, note, created_by, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(e.id, note, auth.actor.email, now)
      .run();

    await recordAudit(env, {
      actor: auth.actor.email,
      action: 'NOTE_ADD',
      entityType: 'enquiry',
      entityId: e.id,
      after: { noteId: inserted.meta && inserted.meta.last_row_id }
    });

    return adminJson({
      ok: true,
      note: {
        id: inserted.meta && inserted.meta.last_row_id,
        note,
        by: auth.actor.email,
        at: now
      }
    }, 201);
  } catch (err) {
    console.error('admin/enquiry notes failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
