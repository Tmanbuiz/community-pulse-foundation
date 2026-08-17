/* =========================================================
   POST /api/admin/enquiries/:id/confirm-funds
   ---------------------------------------------------------
   An administrator marking that a donation actually arrived,
   and sending the donor a thank-you acknowledging it.

   This records a human's confirmation. Money moves by Interac
   e-Transfer outside this system entirely - nothing here takes
   a payment or verifies one. The value of the record is that
   somebody checked the bank and said so, with their name
   against it.

   Requires ADMIN rather than COORDINATOR: confirming money was
   received is a financial assertion, and the resulting email
   makes a statement to a donor on the Foundation's behalf.
   ========================================================= */

import { requireAdmin, adminJson, denied, recordAudit } from '../../../../_lib/admin-auth.js';
import { fundsReceivedEmail, sendMail } from '../../../../_lib/zoho.js';

export async function onRequestPost(context) {
  const auth = await requireAdmin(context, 'ADMIN');
  if (!auth.ok) return denied(auth);

  const { env, request, params } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return adminJson({ ok: false, error: 'invalid_json' }, 400);
  }

  const numeric = /^\d+$/.test(params.id) ? Number(params.id) : null;

  try {
    const e = await env.DB
      .prepare(
        `SELECT * FROM enquiries
          WHERE ${numeric !== null ? 'id = ?' : 'public_ref = ?'} LIMIT 1`
      )
      .bind(numeric !== null ? numeric : params.id)
      .first();

    if (!e) return adminJson({ ok: false, error: 'not_found' }, 404);

    if (e.type !== 'FINANCIAL') {
      return adminJson({ ok: false, error: 'not_a_donation', type: e.type }, 400);
    }

    // Guard against a second confirmation sending the donor a duplicate
    // thank-you for the same gift.
    if (e.funds_received) {
      return adminJson({ ok: false, error: 'already_confirmed', receivedAt: e.received_at }, 409);
    }

    // What actually arrived, which may differ from what was pledged.
    // Falls back to the declared figure when an admin does not restate it.
    const amountReceived =
      typeof body.amount_received === 'string' && body.amount_received.trim()
        ? body.amount_received.trim().slice(0, 40)
        : (e.amount_declared || null);

    const sendThanks = body.send_thanks !== false;
    const now = new Date().toISOString();

    await env.DB
      .prepare(
        `UPDATE enquiries
            SET funds_received = 1, amount_received = ?, received_at = ?,
                received_by = ?, status = 'RESPONDED', last_contact_at = ?,
                updated_at = ?
          WHERE id = ?`
      )
      .bind(amountReceived, now, auth.actor.email, now, now, e.id)
      .run();

    await recordAudit(env, {
      actor: auth.actor.email,
      action: 'FUNDS_CONFIRMED',
      entityType: 'enquiry',
      entityId: e.id,
      before: { funds_received: 0 },
      after: { funds_received: 1, amount_received: amountReceived }
    });

    let emailed = false;
    let emailError = null;

    if (sendThanks) {
      const message = fundsReceivedEmail({
        firstName: e.first_name,
        publicRef: e.public_ref,
        amount: amountReceived
      });

      try {
        await sendMail(env, {
          to: e.email,
          subject: message.subject,
          html: message.html
        });

        await env.DB
          .prepare('UPDATE enquiries SET receipt_sent_at = ? WHERE id = ?')
          .bind(now, e.id)
          .run();

        emailed = true;
      } catch (err) {
        // The confirmation itself stands regardless. Money arriving is a
        // fact about the world; whether an email left afterwards is not.
        emailError = (err && err.message ? err.message : 'unknown_error').slice(0, 300);
        console.error('confirm-funds: thank-you failed', { id: e.id, emailError });
      }
    }

    return adminJson({
      ok: true,
      enquiry: {
        id: e.id,
        reference: e.public_ref,
        fundsReceived: true,
        amountReceived,
        receivedAt: now,
        receivedBy: auth.actor.email,
        thanksSent: emailed,
        thanksError: emailError
      }
    });
  } catch (err) {
    console.error('confirm-funds failed', err && err.message);
    return adminJson({ ok: false, error: 'server_error' }, 500);
  }
}
