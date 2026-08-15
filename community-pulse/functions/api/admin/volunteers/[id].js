/* =========================================================
   GET   /api/admin/volunteers/:id   full profile
   PATCH /api/admin/volunteers/:id   status / archive changes
   ---------------------------------------------------------
   :id accepts either the numeric id or the public reference
   (CPF-VOL-2026-000047), because the reference is what appears
   in emails and is what an admin will have to hand.

   This is the only endpoint that returns accommodation_text.
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../../_lib/admin-auth.js';

const STATUSES = [
  'NEW', 'REVIEWED', 'CONTACTED', 'APPROVED',
  'ACTIVE', 'INACTIVE', 'DECLINED', 'ARCHIVED'
];

// Statuses that mean the volunteer has actually been reached.
const CONTACT_STATUSES = new Set(['CONTACTED', 'APPROVED', 'ACTIVE']);

/** Look up by numeric id or public reference. */
async function loadVolunteer(env, idParam) {
  const numeric = /^\d+$/.test(idParam) ? Number(idParam) : null;

  return env.DB
    .prepare(
      `SELECT * FROM volunteers
        WHERE ${numeric !== null ? 'id = ?' : 'public_ref = ?'}
        LIMIT 1`
    )
    .bind(numeric !== null ? numeric : idParam)
    .first();
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context, 'VIEWER');
  if (!auth.ok) return denied(auth);

  const { env, params } = context;

  try {
    const v = await loadVolunteer(env, params.id);
    if (!v) return adminJson({ ok: false, error: 'not_found' }, 404);

    const [interests, availability, notes, comms, activity] = await env.DB.batch([
      env.DB.prepare('SELECT interest_code FROM volunteer_interests WHERE volunteer_id = ?').bind(v.id),
      env.DB.prepare('SELECT availability_code FROM volunteer_availability WHERE volunteer_id = ?').bind(v.id),
      env.DB.prepare(
        'SELECT id, note, created_by, created_at FROM volunteer_notes WHERE volunteer_id = ? ORDER BY created_at DESC'
      ).bind(v.id),
      env.DB.prepare(
        `SELECT id, type, to_address, subject, status, attempts, error_message, created_at, updated_at
           FROM communications WHERE volunteer_id = ? ORDER BY created_at DESC`
      ).bind(v.id),
      env.DB.prepare(
        `SELECT actor, action, before_json, after_json, created_at
           FROM audit_log
          WHERE entity_type = 'volunteer' AND entity_id = ?
          ORDER BY created_at DESC LIMIT 50`
      ).bind(String(v.id))
    ]);

    return adminJson({
      ok: true,
      actor: auth.actor,
      volunteer: {
        id: v.id,
        reference: v.public_ref,
        firstName: v.first_name,
        lastName: v.last_name,
        name: `${v.first_name} ${v.last_name}`.trim(),
        email: v.email,
        phone: v.phone,
        status: v.status,
        interests: (interests.results || []).map((r) => r.interest_code),
        availability: (availability.results || []).map((r) => r.availability_code),
        skillsText: v.skills_text,
        additionalNote: v.additional_note,

        // Restricted. Present here and nowhere else in the API.
        accommodationText: v.accommodation_text,

        privacyConsent: !!v.privacy_consent,
        privacyConsentVersion: v.privacy_consent_version,
        privacyConsentAt: v.privacy_consent_at,
        updatesConsent: !!v.updates_consent,
        source: v.source,
        submittedAt: v.created_at,
        updatedAt: v.updated_at,
        lastContactAt: v.last_contact_at,
        archivedAt: v.archived_at
      },
      notes: (notes.results || []).map((n) => ({
        id: n.id, note: n.note, by: n.created_by, at: n.created_at
      })),
      communications: (comms.results || []).map((c) => ({
        id: c.id, type: c.type, to: c.to_address, subject: c.subject,
        status: c.status, attempts: c.attempts, error: c.error_message,
        createdAt: c.created_at, updatedAt: c.updated_at
      })),
      activity: (activity.results || []).map((a) => ({
        actor: a.actor, action: a.action, at: a.created_at,
        before: a.before_json ? JSON.parse(a.before_json) : null,
        after: a.after_json ? JSON.parse(a.after_json) : null
      }))
    });
  } catch (err) {
    console.error('admin/volunteer profile failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}

export async function onRequestPatch(context) {
  // Viewers may read but not change anything.
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
    const v = await loadVolunteer(env, params.id);
    if (!v) return adminJson({ ok: false, error: 'not_found' }, 404);

    const sets = [];
    const binds = [];
    const before = {};
    const after = {};

    if (body.status !== undefined) {
      const next = String(body.status).toUpperCase();
      if (!STATUSES.includes(next)) {
        return adminJson({ ok: false, error: 'invalid_status' }, 400);
      }
      if (next !== v.status) {
        sets.push('status = ?');
        binds.push(next);
        before.status = v.status;
        after.status = next;

        // Moving to a contacted state stamps the contact date, which is
        // what the directory's "Last contact" column and the stale-record
        // queue both read.
        if (CONTACT_STATUSES.has(next) && !v.last_contact_at) {
          sets.push('last_contact_at = ?');
          binds.push(new Date().toISOString());
        }
      }
    }

    // Archive is a soft flag, never a delete, so a record can always be
    // recovered and the audit trail stays meaningful.
    if (body.archived !== undefined) {
      const shouldArchive = body.archived === true;
      const isArchived = !!v.archived_at;
      if (shouldArchive !== isArchived) {
        sets.push('archived_at = ?');
        binds.push(shouldArchive ? new Date().toISOString() : null);
        before.archived = isArchived;
        after.archived = shouldArchive;
      }
    }

    if (!sets.length) {
      return adminJson({ ok: true, unchanged: true });
    }

    const now = new Date().toISOString();
    sets.push('updated_at = ?');
    binds.push(now, v.id);

    await env.DB
      .prepare(`UPDATE volunteers SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...binds)
      .run();

    await recordAudit(env, {
      actor: auth.actor.email,
      action: after.status ? 'STATUS_CHANGE' : 'VOLUNTEER_UPDATE',
      entityType: 'volunteer',
      entityId: v.id,
      before,
      after
    });

    const updated = await env.DB
      .prepare('SELECT status, last_contact_at, archived_at, updated_at FROM volunteers WHERE id = ?')
      .bind(v.id)
      .first();

    return adminJson({
      ok: true,
      volunteer: {
        id: v.id,
        reference: v.public_ref,
        status: updated.status,
        lastContactAt: updated.last_contact_at,
        archivedAt: updated.archived_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (err) {
    console.error('admin/volunteer patch failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
