/* =========================================================
   POST /api/admin/volunteers/:id/notes
   ---------------------------------------------------------
   Internal staff notes. Always attributed to the authenticated
   admin and never editable afterwards - a note that could be
   quietly rewritten is worthless as a record of what happened.
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
    const v = await env.DB
      .prepare(
        `SELECT id, public_ref FROM volunteers
          WHERE ${numeric !== null ? 'id = ?' : 'public_ref = ?'} LIMIT 1`
      )
      .bind(numeric !== null ? numeric : params.id)
      .first();

    if (!v) return adminJson({ ok: false, error: 'not_found' }, 404);

    const now = new Date().toISOString();

    const inserted = await env.DB
      .prepare(
        `INSERT INTO volunteer_notes (volunteer_id, note, created_by, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(v.id, note, auth.actor.email, now)
      .run();

    await recordAudit(env, {
      actor: auth.actor.email,
      action: 'NOTE_ADD',
      entityType: 'volunteer',
      entityId: v.id,
      // The note body itself is not duplicated into the audit row; it
      // already lives in volunteer_notes and copying it would spread the
      // same personal data across two tables.
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
    console.error('admin/notes failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
