/* =========================================================
   Zoho Mail - outbound email
   ---------------------------------------------------------
   Zoho is only ever the sending channel. It never stores
   volunteer records; D1 does. Every send is written to the
   `communications` table so a failure is visible and
   retryable from the admin dashboard rather than lost.

   This file lives under functions/_lib/ and exports no
   onRequest handler, so it is bundled into the Worker but
   never becomes a route.

   Required secrets (Cloudflare environment, never in code):
     ZOHO_CLIENT_ID
     ZOHO_CLIENT_SECRET
     ZOHO_REFRESH_TOKEN
   Plaintext vars:
     ZOHO_FROM_ADDRESS      e.g. info@thecommunitypulsefoundation.ca
     ADMIN_NOTIFICATION_TO  e.g. admin@thecommunitypulsefoundation.ca
     APP_BASE_URL

   Data centre note: this organisation is on Zoho's Canada DC,
   so every endpoint is .zohocloud.ca. Using the .com endpoints
   fails with invalid_client even when the credentials are right.
   ========================================================= */

const ZOHO_ACCOUNTS_HOST = 'https://accounts.zohocloud.ca';
const ZOHO_MAIL_HOST = 'https://mail.zohocloud.ca';

/* ---------------------------------------------------------
   Short-lived caches.

   Module scope persists for the life of the isolate, so a
   burst of submissions reuses one access token instead of
   requesting a new one every time. Deliberately NOT persisted
   to D1: an access token is a credential, and the spec keeps
   credentials out of the database. Losing the cache on isolate
   recycle just means one extra token call.
   --------------------------------------------------------- */
let cachedToken = null;      // { value, expiresAt }
let cachedAccountId = null;

/** Escape text that is going into an HTML email body. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Exchange the long-lived refresh token for an access token. */
async function getAccessToken(env) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const params = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token'
  });

  const res = await fetch(`${ZOHO_ACCOUNTS_HOST}/oauth/v2/token?${params}`, {
    method: 'POST'
  });

  const data = await res.json().catch(() => ({}));

  // Zoho returns HTTP 200 with an `error` field on failure, so the
  // status code alone is not enough to tell success from failure.
  if (!res.ok || !data.access_token) {
    throw new Error(`zoho_token_failed: ${data.error || res.status}`);
  }

  cachedToken = {
    value: data.access_token,
    // expires_in is seconds; default to 55 min if absent.
    expiresAt: now + (Number(data.expires_in) || 3300) * 1000
  };
  return cachedToken.value;
}

/**
 * Look up the sending account id.
 * The spec listed ZOHO_ACCOUNT_ID as a required secret, but it is
 * derivable from the token, so it is fetched here instead of asking
 * an admin to go hunting for it.
 */
async function getAccountId(env, accessToken) {
  if (cachedAccountId) return cachedAccountId;

  const res = await fetch(`${ZOHO_MAIL_HOST}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });

  const data = await res.json().catch(() => ({}));
  const account = data && data.data && data.data[0];

  if (!res.ok || !account || !account.accountId) {
    throw new Error(`zoho_account_lookup_failed: ${res.status}`);
  }

  cachedAccountId = account.accountId;
  return cachedAccountId;
}

/**
 * Send one message. Throws on failure so the caller can record
 * FAILED against the communication row.
 */
export async function sendMail(env, { to, subject, html }) {
  if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET || !env.ZOHO_REFRESH_TOKEN) {
    throw new Error('zoho_not_configured');
  }

  const accessToken = await getAccessToken(env);
  const accountId = await getAccountId(env, accessToken);
  // Deliberately a repliable address, not a no-reply one: Zoho's send API
  // has no replyTo parameter, so the From address is the only way a
  // volunteer can respond to their acknowledgement.
  // Zoho only permits sending from an address the authenticated account
  // owns, so this must be the mailbox itself or one of its aliases.
  const fromAddress = env.ZOHO_FROM_ADDRESS || 'info@thecommunitypulsefoundation.ca';

  const res = await fetch(`${ZOHO_MAIL_HOST}/api/accounts/${accountId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fromAddress,
      toAddress: to,
      subject,
      content: html,
      mailFormat: 'html'
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // A common first-run failure is Zoho refusing to send from an
    // alias. Surface that clearly rather than as a bare 400.
    const detail = (data && data.data && data.data.errorCode) || res.status;
    throw new Error(`zoho_send_failed: ${detail}`);
  }

  return (data && data.data && data.data.messageId) || null;
}

/* =========================================================
   Templates
   ========================================================= */

const SIGNATURE = `
  <p style="margin:24px 0 0">Warm regards,<br />
  <strong>The Community Pulse Foundation</strong><br />
  <span style="color:#636e72">Connecting People. Building Community.</span></p>
`;

const WRAP = (inner) => `
<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2d3436;max-width:600px">
  ${inner}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 12px" />
  <p style="font-size:12px;color:#999;margin:0">
    The Community Pulse Foundation Inc. &middot; a non-profit organization incorporated in New Brunswick, Canada
  </p>
</div>`;

/**
 * Acknowledgement to the volunteer.
 * Wording is deliberately "we received this and will review it" —
 * never anything that implies the person has been accepted or placed.
 */
export function acknowledgementEmail({ firstName, publicRef }) {
  const name = escapeHtml(firstName);
  const ref = escapeHtml(publicRef);

  return {
    subject: 'Thank you for supporting your community',
    html: WRAP(`
      <p>Hi ${name},</p>

      <p>Thank you for expressing your interest in volunteering with
      The Community Pulse Foundation.</p>

      <p>We have received your submission and a member of our team will review
      the information you provided. Your willingness to give your time, skills
      and energy is a meaningful act of community support, and we appreciate
      your interest in helping build stronger, more connected and inclusive
      communities.</p>

      <p style="background:#f8fafb;border-left:4px solid #0d7377;padding:12px 16px;margin:20px 0">
        <strong>Volunteer reference:</strong> ${ref}
      </p>

      <p>Please keep this reference for future correspondence. Submission
      acknowledgement does not confirm a volunteer placement; our team will
      contact you regarding suitable opportunities or next steps.</p>

      <p>Thank you again for choosing to contribute.</p>
      ${SIGNATURE}
    `)
  };
}

/**
 * Internal notification that a new record exists.
 * Intentionally minimal: no accommodation notes, no skills free text,
 * no additional notes. Those stay behind the admin login.
 */
export function adminNotificationEmail({ publicRef, firstName, lastName, interests, availability, submittedAt, baseUrl }) {
  const ref = escapeHtml(publicRef);
  const name = escapeHtml(`${firstName} ${lastName}`.trim());
  const interestList = escapeHtml((interests || []).join(', ') || '—');
  const availabilityList = escapeHtml((availability || []).join(', ') || '—');
  const link = `${baseUrl || ''}/admin/volunteers/${encodeURIComponent(publicRef)}`;

  return {
    subject: `New volunteer application - ${ref}`,
    html: WRAP(`
      <p>A new volunteer application has been received.</p>

      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 16px 4px 0;color:#636e72">Reference</td><td><strong>${ref}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#636e72">Name</td><td>${name}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#636e72">Interests</td><td>${interestList}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#636e72">Availability</td><td>${availabilityList}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#636e72">Submitted</td><td>${escapeHtml(submittedAt)}</td></tr>
      </table>

      <p><a href="${escapeHtml(link)}"
            style="background:#0d7377;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;display:inline-block">
        View application
      </a></p>

      <p style="font-size:13px;color:#636e72">Contact details and any accessibility
      information are available on the secure admin record, not in this email.</p>
    `)
  };
}

/* =========================================================
   Delivery + logging
   ========================================================= */

/**
 * Send a queued communication and record the outcome.
 *
 * Never throws. A mail failure must not affect whether the volunteer's
 * application was accepted, so the worst case here is a FAILED row that
 * an admin can retry from the dashboard.
 */
export async function deliverCommunication(env, communicationId, { to, subject, html }) {
  const now = new Date().toISOString();

  try {
    const providerId = await sendMail(env, { to, subject, html });

    await env.DB
      .prepare(
        `UPDATE communications
            SET status = 'SENT', provider_id = ?, attempts = attempts + 1,
                error_message = NULL, updated_at = ?
          WHERE id = ?`
      )
      .bind(providerId, now, communicationId)
      .run();

    return { ok: true };
  } catch (err) {
    const message = (err && err.message ? err.message : 'unknown_error').slice(0, 300);

    // Log the error class only. No personal data in error columns.
    console.error('zoho: send failed', { communicationId, message });

    await env.DB
      .prepare(
        `UPDATE communications
            SET status = 'FAILED', attempts = attempts + 1,
                error_message = ?, updated_at = ?
          WHERE id = ?`
      )
      .bind(message, now, communicationId)
      .run()
      .catch(() => { /* the send failure is already logged; do not mask it */ });

    return { ok: false, error: message };
  }
}
