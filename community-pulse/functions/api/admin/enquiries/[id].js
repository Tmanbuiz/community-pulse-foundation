/* =========================================================
   GET   /api/admin/enquiries/:id   full record
   PATCH /api/admin/enquiries/:id   status / archive changes
   ---------------------------------------------------------
   :id accepts the numeric id or the public reference
   (CPF-ENQ-2026-000012), since the reference is what appears
   in emails.
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../../_lib/admin-auth.js';
import {
  enquiryStatusUpdateEmail,
  queueEnquiryComm,
  deliverEnquiryComm
} from '../../../_lib/zoho.js';

const STATUSES = ['NEW', 'REVIEWED', 'RESPONDED', 'CLOSED', 'ARCHIVED'];
const CONTACT_STATUSES = new Set(['RESPONDED', 'CLOSED']);

// Statuses a person can meaningfully be told about. NEW is the state they
// arrived in, and ARCHIVED is internal bookkeeping - emailing either would be
// noise. Nothing sends unless an admin explicitly asks for it anyway; this
// only bounds what they are allowed to ask for.
const NOTIFIABLE = new Set(['REVIEWED', 'RESPONDED', 'CLOSED']);

const MAX_PERSONAL_NOTE = 1000;

async function loadEnquiry(env, idParam) {
  const numeric = /^\d+$/.test(idParam) ? Number(idParam) : null;
  return env.DB
    .prepare(
      `SELECT * FROM enquiries
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
    const e = await loadEnquiry(env, params.id);
    if (!e) return adminJson({ ok: false, error: 'not_found' }, 404);

    const [notes, activity, comms] = await env.DB.batch([
      env.DB.prepare(
        'SELECT id, note, created_by, created_at FROM enquiry_notes WHERE enquiry_id = ? ORDER BY created_at DESC'
      ).bind(e.id),
      env.DB.prepare(
        `SELECT actor, action, before_json, after_json, created_at
           FROM audit_log
          WHERE entity_type = 'enquiry' AND entity_id = ?
          ORDER BY created_at DESC LIMIT 50`
      ).bind(String(e.id)),
      env.DB.prepare(
        `SELECT id, type, to_address, subject, status, error_message, created_by, created_at
           FROM enquiry_communications
          WHERE enquiry_id = ?
          ORDER BY created_at DESC LIMIT 50`
      ).bind(e.id)
    ]);

    return adminJson({
      ok: true,
      actor: auth.actor,
      enquiry: {
        id: e.id,
        reference: e.public_ref,
        type: e.type,
        firstName: e.first_name,
        lastName: e.last_name,
        name: `${e.first_name} ${e.last_name}`.trim(),
        email: e.email,
        phone: e.phone,
        status: e.status,

        itemTypes: e.item_types ? e.item_types.split(',') : [],
        itemDescription: e.item_description,
        pickupNeeded: e.pickup_needed === null ? null : !!e.pickup_needed,
        preferredDate: e.preferred_date,
        message: e.message,

        amountDeclared: e.amount_declared,
        amountReceived: e.amount_received,
        fundsReceived: !!e.funds_received,
        receivedAt: e.received_at,
        receivedBy: e.received_by,
        receiptSentAt: e.receipt_sent_at,

        ackStatus: e.ack_status,
        ackAttempts: e.ack_attempts,
        ackError: e.ack_error,

        privacyConsentVersion: e.privacy_consent_version,
        privacyConsentAt: e.privacy_consent_at,
        submittedAt: e.created_at,
        lastContactAt: e.last_contact_at,
        archivedAt: e.archived_at
      },
      notes: (notes.results || []).map((n) => ({
        id: n.id, note: n.note, by: n.created_by, at: n.created_at
      })),
      communications: (comms.results || []).map((c) => ({
        id: c.id,
        type: c.type,
        to: c.to_address,
        subject: c.subject,
        status: c.status,
        error: c.error_message,
        by: c.created_by,
        at: c.created_at
      })),
      activity: (activity.results || []).map((a) => ({
        actor: a.actor, action: a.action, at: a.created_at,
        before: a.before_json ? JSON.parse(a.before_json) : null,
        after: a.after_json ? JSON.parse(a.after_json) : null
      }))
    });
  } catch (err) {
    console.error('admin/enquiry profile failed', err && err.message);
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
    const e = await loadEnquiry(env, params.id);
    if (!e) return adminJson({ ok: false, error: 'not_found' }, 404);

    const sets = [];
    const binds = [];
    const before = {};
    const after = {};

    if (body.status !== undefined) {
      const next = String(body.status).toUpperCase();
      if (!STATUSES.includes(next)) {
        return adminJson({ ok: false, error: 'invalid_status' }, 400);
      }
      if (next !== e.status) {
        sets.push('status = ?');
        binds.push(next);
        before.status = e.status;
        after.status = next;

        if (CONTACT_STATUSES.has(next) && !e.last_contact_at) {
          sets.push('last_contact_at = ?');
          binds.push(new Date().toISOString());
        }
      }
    }

    if (body.archived !== undefined) {
      const shouldArchive = body.archived === true;
      const isArchived = !!e.archived_at;
      if (shouldArchive !== isArchived) {
        sets.push('archived_at = ?');
        binds.push(shouldArchive ? new Date().toISOString() : null);
        before.archived = isArchived;
        after.archived = shouldArchive;
      }
    }

    if (!sets.length) return adminJson({ ok: true, unchanged: true });

    const now = new Date().toISOString();
    sets.push('updated_at = ?');
    binds.push(now, e.id);

    await env.DB
      .prepare(`UPDATE enquiries SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...binds)
      .run();

    await recordAudit(env, {
      actor: auth.actor.email,
      action: after.status ? 'STATUS_CHANGE' : 'ENQUIRY_UPDATE',
      entityType: 'enquiry',
      entityId: e.id,
      before,
      after
    });

    /* ---------------- optional notification ----------------
       Deliberately after the update and the audit entry. The status change is
       the fact of record; the email is a courtesy on top of it. If Zoho is
       down, the change still stands and the admin is told the mail failed
       rather than the whole request being rolled back. */
    let notified = null;

    const wantsNotify = body.notify === true;
    if (wantsNotify && after.status && NOTIFIABLE.has(after.status)) {
      const personalNote =
        typeof body.note === 'string' ? body.note.trim().slice(0, MAX_PERSONAL_NOTE) : '';

      const mail = enquiryStatusUpdateEmail({
        status: after.status,
        type: e.type,
        firstName: e.first_name,
        publicRef: e.public_ref,
        note: personalNote
      });

      if (mail) {
        try {
          const commId = await queueEnquiryComm(env, {
            enquiryId: e.id,
            type: 'STATUS_UPDATE',
            to: e.email,
            subject: mail.subject,
            preview: personalNote || after.status,
            createdBy: auth.actor.email
          });

          const sent = await deliverEnquiryComm(env, commId, {
            to: e.email,
            subject: mail.subject,
            html: mail.html
          });

          notified = sent.ok ? { sent: true, to: e.email } : { sent: false, error: sent.error };

          await recordAudit(env, {
            actor: auth.actor.email,
            action: 'STATUS_EMAIL_SEND',
            entityType: 'enquiry',
            entityId: e.id,
            after: { status: after.status, sent: sent.ok, hadNote: !!personalNote }
          });
        } catch (mailErr) {
          // Never let a mail problem surface as a failed status change.
          const message = (mailErr && mailErr.message ? mailErr.message : 'unknown').slice(0, 300);
          console.error('admin/enquiry status email failed', message);
          notified = { sent: false, error: message };
        }
      }
    } else if (wantsNotify) {
      // Asked for, but not permitted for this transition. Say so plainly
      // rather than silently doing nothing.
      notified = { sent: false, error: 'not_notifiable' };
    }

    const updated = await env.DB
      .prepare('SELECT status, last_contact_at, archived_at, updated_at FROM enquiries WHERE id = ?')
      .bind(e.id)
      .first();

    return adminJson({
      ok: true,
      notified,
      enquiry: {
        id: e.id,
        reference: e.public_ref,
        status: updated.status,
        lastContactAt: updated.last_contact_at,
        archivedAt: updated.archived_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (err) {
    console.error('admin/enquiry patch failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
