/* =========================================================
   POST /api/admin/communications/:id/retry
   ---------------------------------------------------------
   Re-send a failed email.

   Bodies are never stored - only a subject and a short preview -
   so a retry regenerates the message from the volunteer record
   using the same template. That is deliberate: keeping full
   rendered emails would duplicate personal data into a second
   table for no operational gain, and the templates are pure
   functions of the record anyway.
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../../../_lib/admin-auth.js';
import { acknowledgementEmail, adminNotificationEmail, deliverCommunication } from '../../../../_lib/zoho.js';

const INTEREST_LABELS = {
  community_events: 'Community Events',
  packaging_sorting: 'Packaging / Sorting',
  transport_support: 'Transportation / Pick-up Support',
  outreach_awareness: 'Outreach / Awareness',
  general_support: 'General Support',
  other: 'Other'
};

const AVAILABILITY_LABELS = {
  weekday: 'Weekdays',
  evening: 'Evenings',
  weekend: 'Weekends',
  flexible: 'Flexible',
  event_based: 'Event-based / as needed',
  other: 'Other'
};

export async function onRequestPost(context) {
  const auth = await requireAdmin(context, 'COORDINATOR');
  if (!auth.ok) return denied(auth);

  const { env, params } = context;
  const commId = Number(params.id);

  if (!Number.isInteger(commId)) {
    return adminJson({ ok: false, error: 'invalid_id' }, 400);
  }

  try {
    const comm = await env.DB
      .prepare('SELECT * FROM communications WHERE id = ?')
      .bind(commId)
      .first();

    if (!comm) return adminJson({ ok: false, error: 'not_found' }, 404);

    if (comm.status === 'SENT') {
      // Guard against a double-click resending a message the volunteer
      // has already received.
      return adminJson({ ok: false, error: 'already_sent' }, 409);
    }

    const v = await env.DB
      .prepare('SELECT * FROM volunteers WHERE id = ?')
      .bind(comm.volunteer_id)
      .first();

    if (!v) return adminJson({ ok: false, error: 'volunteer_missing' }, 404);

    let message;
    if (comm.type === 'ACKNOWLEDGEMENT') {
      message = acknowledgementEmail({
        firstName: v.first_name,
        publicRef: v.public_ref
      });
    } else if (comm.type === 'ADMIN_NOTIFICATION') {
      const [interests, availability] = await env.DB.batch([
        env.DB.prepare('SELECT interest_code FROM volunteer_interests WHERE volunteer_id = ?').bind(v.id),
        env.DB.prepare('SELECT availability_code FROM volunteer_availability WHERE volunteer_id = ?').bind(v.id)
      ]);

      message = adminNotificationEmail({
        publicRef: v.public_ref,
        firstName: v.first_name,
        lastName: v.last_name,
        interests: (interests.results || []).map((r) => INTEREST_LABELS[r.interest_code] || r.interest_code),
        availability: (availability.results || []).map((r) => AVAILABILITY_LABELS[r.availability_code] || r.availability_code),
        submittedAt: v.created_at,
        // This deployment, not the canonical site: the retried notification
        // should link to the CRM holding the record, which is the one the
        // admin is retrying from.
        baseUrl: new URL(context.request.url).origin
      });
    } else {
      // ADMIN_EMAIL and anything added later have no regenerable template.
      return adminJson({ ok: false, error: 'type_not_retryable', type: comm.type }, 400);
    }

    // Mark the previous failure as retried before attempting, so the
    // history shows the attempt even if this one also fails.
    await env.DB
      .prepare("UPDATE communications SET status = 'RETRIED', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), commId)
      .run();

    const result = await deliverCommunication(env, commId, {
      to: comm.to_address,
      subject: message.subject,
      html: message.html
    });

    await recordAudit(env, {
      actor: auth.actor.email,
      action: 'EMAIL_RETRY',
      entityType: 'communication',
      entityId: commId,
      before: { status: comm.status, attempts: comm.attempts },
      after: { status: result.ok ? 'SENT' : 'FAILED' }
    });

    const refreshed = await env.DB
      .prepare('SELECT status, attempts, error_message, updated_at FROM communications WHERE id = ?')
      .bind(commId)
      .first();

    return adminJson({
      ok: result.ok,
      error: result.ok ? undefined : 'send_failed',
      communication: {
        id: commId,
        status: refreshed.status,
        attempts: refreshed.attempts,
        error: refreshed.error_message,
        updatedAt: refreshed.updated_at
      }
    }, result.ok ? 200 : 502);
  } catch (err) {
    console.error('admin/retry failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
