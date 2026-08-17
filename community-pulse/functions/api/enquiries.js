/* =========================================================
   POST /api/enquiries  -  everything that is not a volunteer
   ---------------------------------------------------------
   Item donations, financial support, community questions and
   anything else from the Get Involved form.

   Same guarantees as /api/volunteers: server-side Turnstile
   verification, strict validation, an idempotency key, and the
   record committed before any email is attempted.
   ========================================================= */

import {
  enquiryAcknowledgementEmail,
  enquiryAdminNotificationEmail,
  deliverEnquiryAck,
  sendMail
} from '../_lib/zoho.js';

const TYPES = new Set(['ITEM_DONATION', 'FINANCIAL', 'QUESTION', 'OTHER']);

const ITEM_CODES = new Set(['food', 'clothing', 'hygiene', 'household', 'other']);

const LIMITS = {
  name: { min: 2, max: 80 },
  email: 254,
  phone: 40,
  freeText: 1500,
  submissionId: 100
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function clean(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function cleanMultiline(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim().slice(0, max);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= LIMITS.email;
}

function validCodes(input, allowed) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const code = raw.trim();
    if (allowed.has(code)) seen.add(code);
  }
  return [...seen];
}

async function verifyTurnstile(token, secret, remoteIp) {
  const form = new URLSearchParams();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  });

  if (!res.ok) return { success: false, codes: ['siteverify_unreachable'] };
  const data = await res.json();
  return { success: data.success === true, codes: data['error-codes'] || [] };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const missing = [];
  if (!env.DB) missing.push('DB');
  if (!env.TURNSTILE_SECRET) missing.push('TURNSTILE_SECRET');
  if (missing.length) {
    console.error('enquiries: missing configuration', missing.join(','));
    return json({ ok: false, error: 'server_misconfigured', missing }, 500);
  }

  // CSRF guard. This compares against the request's *own* origin, not the
  // canonical one: the form is always served from the same deployment that
  // receives the post, so same-origin is the accurate test and it works
  // unchanged on production, preview and branch deployments. Comparing to
  // APP_BASE_URL instead rejected every preview submission before it reached
  // the database.
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'bad_origin' }, 403);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const submissionId = clean(payload.submission_id);
  if (!submissionId || submissionId.length > LIMITS.submissionId) {
    return json({ ok: false, error: 'validation_failed', fields: { submission_id: 'A valid submission id is required.' } }, 400);
  }

  const turnstileToken = clean(payload.turnstile_token);
  if (!turnstileToken) {
    return json({ ok: false, error: 'turnstile_missing' }, 400);
  }

  const verdict = await verifyTurnstile(
    turnstileToken,
    env.TURNSTILE_SECRET,
    request.headers.get('CF-Connecting-IP')
  );

  if (!verdict.success) {
    const recoverable =
      verdict.codes.includes('timeout-or-duplicate') ||
      verdict.codes.includes('invalid-input-response');
    return json({ ok: false, error: 'turnstile_failed', recoverable }, recoverable ? 400 : 403);
  }

  /* ---------------- validation ---------------- */
  const errors = {};

  const type = clean(payload.type).toUpperCase();
  if (!TYPES.has(type)) {
    return json({ ok: false, error: 'invalid_type' }, 400);
  }

  const firstName = clean(payload.first_name);
  const lastName = clean(payload.last_name);
  const email = clean(payload.email).toLowerCase();
  const phone = clean(payload.phone).slice(0, LIMITS.phone);

  if (firstName.length < LIMITS.name.min || firstName.length > LIMITS.name.max) {
    errors.first_name = 'Please enter your first name.';
  }
  if (lastName.length < LIMITS.name.min || lastName.length > LIMITS.name.max) {
    errors.last_name = 'Please enter your last name.';
  }
  if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (payload.privacy_consent !== true) {
    errors.privacy_consent = 'We need your consent in order to respond to you.';
  }

  const itemTypes = validCodes(payload.item_types, ITEM_CODES);
  const itemDescription = cleanMultiline(payload.item_description, LIMITS.freeText);
  const message = cleanMultiline(payload.message, LIMITS.freeText);

  // Only ask for what the chosen branch actually needs. Requiring a message
  // from someone offering a financial donation would be pointless friction.
  if (type === 'ITEM_DONATION' && itemTypes.length === 0 && !itemDescription) {
    errors.item_types = 'Please tell us what you would like to donate.';
  }
  if ((type === 'QUESTION' || type === 'OTHER') && !message) {
    errors.message = 'Please let us know what you would like to say.';
  }

  if (Object.keys(errors).length > 0) {
    return json({ ok: false, error: 'validation_failed', fields: errors }, 400);
  }

  const pickupNeeded =
    type === 'ITEM_DONATION' && payload.pickup_needed !== undefined
      ? (payload.pickup_needed === true || payload.pickup_needed === 'Yes' ? 1 : 0)
      : null;

  const preferredDate =
    type === 'ITEM_DONATION' && /^\d{4}-\d{2}-\d{2}$/.test(String(payload.preferred_date || ''))
      ? payload.preferred_date
      : null;

  // Stored as the donor typed it. No parsing into a number, and no payment
  // is taken here - this is a stated intention that an administrator later
  // reconciles against what actually arrived by e-Transfer.
  const amountDeclared =
    type === 'FINANCIAL' ? clean(payload.amount_declared).slice(0, 40) : '';

  const now = new Date().toISOString();
  const consentVersion = env.PRIVACY_CONSENT_VERSION || '2026-08-v1';

  try {
    const existing = await env.DB
      .prepare('SELECT public_ref FROM enquiries WHERE submission_id = ?')
      .bind(submissionId)
      .first();

    if (existing) {
      return json({ ok: true, duplicate: true, reference: existing.public_ref }, 200);
    }

    const insert = await env.DB
      .prepare(
        `INSERT INTO enquiries (
           submission_id, type, first_name, last_name, email, phone, status,
           item_types, item_description, pickup_needed, preferred_date, message,
           amount_declared,
           privacy_consent, privacy_consent_version, privacy_consent_at,
           source, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?, 1, ?, ?, 'website', ?, ?)`
      )
      .bind(
        submissionId,
        type,
        firstName,
        lastName,
        email,
        phone || null,
        itemTypes.length ? itemTypes.join(',') : null,
        itemDescription || null,
        pickupNeeded,
        preferredDate,
        message || null,
        amountDeclared || null,
        consentVersion,
        now,
        now,
        now
      )
      .run();

    const enquiryId = insert.meta.last_row_id;
    if (!enquiryId) throw new Error('insert returned no row id');

    const publicRef = `CPF-ENQ-${new Date().getUTCFullYear()}-${String(enquiryId).padStart(6, '0')}`;

    await env.DB.batch([
      env.DB.prepare('UPDATE enquiries SET public_ref = ? WHERE id = ?').bind(publicRef, enquiryId),
      env.DB
        .prepare(
          `INSERT INTO audit_log (actor, action, entity_type, entity_id, after_json, created_at)
           VALUES ('system', 'ENQUIRY_CREATE', 'enquiry', ?, ?, ?)`
        )
        .bind(String(enquiryId), JSON.stringify({ public_ref: publicRef, type }), now)
    ]);

    // Stored safely from here. Email is best-effort.
    const ack = enquiryAcknowledgementEmail({
      firstName,
      publicRef,
      type,
      donationEmail: env.DONATION_EMAIL || 'donations@thecommunitypulsefoundation.ca'
    });

    const adminNote = enquiryAdminNotificationEmail({
      publicRef,
      firstName,
      lastName,
      type,
      submittedAt: now,
      // The deployment that received the submission, not the canonical site.
      // The record lives in this deployment's database, so a canonical link
      // would send an admin to a CRM that cannot show them the record they
      // were just emailed about.
      baseUrl: new URL(request.url).origin
    });

    const adminTo = env.ADMIN_NOTIFICATION_TO || 'admin@thecommunitypulsefoundation.ca';

    context.waitUntil(
      Promise.all([
        deliverEnquiryAck(env, enquiryId, {
          to: email,
          subject: ack.subject,
          html: ack.html
        }),
        // The admin copy is genuinely fire-and-forget: if it fails the
        // enquiry is still visible in the CRM, so there is nothing to retry
        // against and no state worth recording.
        sendMail(env, {
          to: adminTo,
          subject: adminNote.subject,
          html: adminNote.html
        }).catch((err) => {
          console.error('enquiries: admin notification failed', err && err.message);
        })
      ])
    );

    return json({ ok: true, reference: publicRef }, 201);
  } catch (err) {
    const detail = (err && err.message ? err.message : 'unknown').slice(0, 300);
    console.error('enquiries: create failed', { submission_id: submissionId, detail });

    // Logged server-side only. The cause is schema detail and is not something
    // a member of the public should be shown.
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
