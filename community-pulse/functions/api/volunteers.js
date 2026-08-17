/* =========================================================
   POST /api/volunteers  -  public volunteer submission
   ---------------------------------------------------------
   Cloudflare Pages Function. Runs server-side only; the
   browser never touches D1 directly.

   Required bindings / environment:
     DB                       D1 database binding
     TURNSTILE_SECRET         Turnstile secret key (server-only)
     PRIVACY_CONSENT_VERSION  e.g. "2026-08-v1"
     APP_BASE_URL             e.g. "https://thecommunitypulsefoundation.ca"

   Order of operations matters: the volunteer record is saved
   BEFORE any email is attempted. A mail outage must never
   reject a valid application.
   ========================================================= */

import {
  acknowledgementEmail,
  adminNotificationEmail,
  deliverCommunication
} from '../_lib/zoho.js';

// Controlled category codes. Anything not in these sets is rejected
// rather than stored, so the admin filters stay meaningful.
// The labels are only for human-readable email/admin display; the
// codes are what actually goes in the database.
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

const INTEREST_CODES = new Set(Object.keys(INTEREST_LABELS));
const AVAILABILITY_CODES = new Set(Object.keys(AVAILABILITY_LABELS));

const LIMITS = {
  name: { min: 2, max: 80 },
  email: 254,
  phone: 40,
  freeText: 1500,
  submissionId: 100
};

/* ---------------- helpers ---------------- */

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function fieldError(errors) {
  return json({ ok: false, error: 'validation_failed', fields: errors }, 400);
}

// Collapse whitespace and trim. Returns '' for null/undefined.
function clean(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

// Free text keeps its line breaks, but still gets trimmed and capped.
function cleanMultiline(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim().slice(0, max);
}

function isValidEmail(value) {
  // Deliberately permissive: reject the obviously broken, let the
  // acknowledgement email be the real proof of deliverability.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= LIMITS.email;
}

// Keep only the codes we recognise, de-duplicated.
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

function buildPublicRef(prefix, year, id) {
  return `${prefix}-${year}-${String(id).padStart(6, '0')}`;
}

// Verify the Turnstile token with Cloudflare. Never trust the widget alone.
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

/* ---------------- handler ---------------- */

export async function onRequestPost(context) {
  const { request, env } = context;

  // --- configuration guard -------------------------------------------------
  // Fail loudly server-side rather than silently accepting submissions we
  // cannot store or validate.
  // Distinct codes per missing piece. Deployments have separate production
  // and preview configuration, so "which half is missing" is the first thing
  // worth knowing when this fires. No values are exposed, only which name is
  // absent.
  const missing = [];
  if (!env.DB) missing.push('DB');
  if (!env.TURNSTILE_SECRET) missing.push('TURNSTILE_SECRET');

  if (missing.length) {
    console.error('volunteers: missing configuration', missing.join(','));
    return json(
      { ok: false, error: 'server_misconfigured', missing },
      500
    );
  }

  // Canonical site address, used for links inside emails.
  const allowedOrigin = env.APP_BASE_URL || 'https://thecommunitypulsefoundation.ca';

  // --- origin check (state-changing request) -------------------------------
  // Compared against the request's own origin rather than the canonical one,
  // so the guard holds on production, preview and branch deployments alike.
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'bad_origin' }, 403);
  }

  // --- parse ---------------------------------------------------------------
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // --- idempotency key -----------------------------------------------------
  const submissionId = clean(payload.submission_id);
  if (!submissionId || submissionId.length > LIMITS.submissionId) {
    return fieldError({ submission_id: 'A valid submission id is required.' });
  }

  // --- bot protection ------------------------------------------------------
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
    // Expired/duplicate tokens are recoverable: the browser should refresh
    // the widget and let the person submit again.
    const recoverable =
      verdict.codes.includes('timeout-or-duplicate') ||
      verdict.codes.includes('invalid-input-response');
    return json(
      { ok: false, error: 'turnstile_failed', recoverable },
      recoverable ? 400 : 403
    );
  }

  // --- field validation ----------------------------------------------------
  const errors = {};

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

  const interests = validCodes(payload.interests, INTEREST_CODES);
  const availability = validCodes(payload.availability, AVAILABILITY_CODES);

  if (interests.length === 0) {
    errors.interests = 'Please choose at least one way you would like to help.';
  }
  if (availability.length === 0) {
    errors.availability = 'Please choose at least one availability option.';
  }

  if (payload.privacy_consent !== true) {
    errors.privacy_consent = 'We need your consent in order to process your interest.';
  }

  if (Object.keys(errors).length > 0) {
    return fieldError(errors);
  }

  const skillsText = cleanMultiline(payload.skills_text, LIMITS.freeText);
  const accommodationText = cleanMultiline(payload.accommodation_text, LIMITS.freeText);
  const additionalNote = cleanMultiline(payload.additional_note, LIMITS.freeText);
  const updatesConsent = payload.updates_consent === true ? 1 : 0;

  const now = new Date().toISOString();
  const consentVersion = env.PRIVACY_CONSENT_VERSION || '2026-08-v1';

  try {
    // --- safe retry of an identical submission -----------------------------
    // A double-click or a refresh after a slow response must not create a
    // second volunteer or trigger a second acknowledgement.
    const existing = await env.DB
      .prepare('SELECT public_ref FROM volunteers WHERE submission_id = ?')
      .bind(submissionId)
      .first();

    if (existing) {
      return json(
        { ok: true, duplicate: true, reference: existing.public_ref },
        200
      );
    }

    // --- create the canonical record ---------------------------------------
    const insert = await env.DB
      .prepare(
        `INSERT INTO volunteers (
           submission_id, first_name, last_name, email, phone, status,
           skills_text, accommodation_text, additional_note,
           privacy_consent, privacy_consent_version, privacy_consent_at,
           updates_consent, source, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'NEW', ?, ?, ?, 1, ?, ?, ?, 'website', ?, ?)`
      )
      .bind(
        submissionId,
        firstName,
        lastName,
        email,
        phone || null,
        skillsText || null,
        accommodationText || null,
        additionalNote || null,
        consentVersion,
        now,
        updatesConsent,
        now,
        now
      )
      .run();

    const volunteerId = insert.meta.last_row_id;
    if (!volunteerId) {
      throw new Error('insert returned no row id');
    }

    const publicRef = buildPublicRef('CPF-VOL', new Date().getUTCFullYear(), volunteerId);

    // Tag rows and the public reference go in one batch so we do not leave a
    // half-built record behind if something fails partway.
    const statements = [
      env.DB
        .prepare('UPDATE volunteers SET public_ref = ? WHERE id = ?')
        .bind(publicRef, volunteerId)
    ];

    for (const code of interests) {
      statements.push(
        env.DB
          .prepare('INSERT OR IGNORE INTO volunteer_interests (volunteer_id, interest_code) VALUES (?, ?)')
          .bind(volunteerId, code)
      );
    }
    for (const code of availability) {
      statements.push(
        env.DB
          .prepare('INSERT OR IGNORE INTO volunteer_availability (volunteer_id, availability_code) VALUES (?, ?)')
          .bind(volunteerId, code)
      );
    }

    statements.push(
      env.DB
        .prepare(
          `INSERT INTO audit_log (actor, action, entity_type, entity_id, after_json, created_at)
           VALUES ('system', 'VOLUNTEER_CREATE', 'volunteer', ?, ?, ?)`
        )
        .bind(String(volunteerId), JSON.stringify({ public_ref: publicRef, status: 'NEW' }), now)
    );

    await env.DB.batch(statements);

    // ---------------------------------------------------------------------
    // The application is safely stored from this point on. Everything below
    // is best-effort: it can fail, be retried, or be skipped entirely without
    // changing the fact that this volunteer applied successfully.
    // ---------------------------------------------------------------------
    const interestLabels = interests.map((c) => INTEREST_LABELS[c] || c);
    const availabilityLabels = availability.map((c) => AVAILABILITY_LABELS[c] || c);

    const ack = acknowledgementEmail({ firstName, publicRef });
    const adminNote = adminNotificationEmail({
      publicRef,
      firstName,
      lastName,
      interests: interestLabels,
      availability: availabilityLabels,
      submittedAt: now,
      baseUrl: allowedOrigin
    });
    const adminTo = env.ADMIN_NOTIFICATION_TO || 'admin@thecommunitypulsefoundation.ca';

    // Both rows are created PENDING first, so an admin can still see that an
    // email was owed even if the isolate dies before delivery completes.
    const queued = await env.DB.batch([
      env.DB
        .prepare(
          `INSERT INTO communications
             (volunteer_id, type, to_address, subject, status, created_at, updated_at)
           VALUES (?, 'ACKNOWLEDGEMENT', ?, ?, 'PENDING', ?, ?)`
        )
        .bind(volunteerId, email, ack.subject, now, now),
      env.DB
        .prepare(
          `INSERT INTO communications
             (volunteer_id, type, to_address, subject, status, created_at, updated_at)
           VALUES (?, 'ADMIN_NOTIFICATION', ?, ?, 'PENDING', ?, ?)`
        )
        .bind(volunteerId, adminTo, adminNote.subject, now, now)
    ]);

    const ackId = queued[0] && queued[0].meta && queued[0].meta.last_row_id;
    const adminId = queued[1] && queued[1].meta && queued[1].meta.last_row_id;

    // Deliver after the response is sent. The volunteer should not sit
    // watching a spinner while we wait on Zoho.
    context.waitUntil(
      Promise.all([
        ackId
          ? deliverCommunication(env, ackId, {
              to: email,
              subject: ack.subject,
              html: ack.html
            })
          : Promise.resolve(),
        adminId
          ? deliverCommunication(env, adminId, {
              to: adminTo,
              subject: adminNote.subject,
              html: adminNote.html
            })
          : Promise.resolve()
      ])
    );

    return json({ ok: true, reference: publicRef }, 201);
  } catch (err) {
    // Log enough to debug without dumping the whole personal record.
    console.error('volunteers: create failed', {
      submission_id: submissionId,
      message: err && err.message
    });
    return json({ ok: false, error: 'server_error' }, 500);
  }
}

// Only POST is exported, so Pages answers other methods with 405 by itself.

