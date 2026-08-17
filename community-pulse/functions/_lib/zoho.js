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
  const rawFrom = env.ZOHO_FROM_ADDRESS || 'info@thecommunitypulsefoundation.ca';

  // Send as: The Community Pulse Foundation <info@...>
  // Without a display name, inboxes show the local part ("info"), which
  // looks like a stray account rather than the organisation. If the
  // configured value already carries a display name, leave it alone.
  const fromName = env.ZOHO_FROM_NAME || 'The Community Pulse Foundation';
  const fromAddress = rawFrom.includes('<')
    ? rawFrom
    : `${fromName} <${rawFrom}>`;

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
  // The CRM is hash-routed, so the fragment is what selects the record.
  // A path-style /crm/volunteers/REF would just load the dashboard.
  const link = `${baseUrl || ''}/crm/#/volunteers/${encodeURIComponent(publicRef)}`;

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

/* ---------------------------------------------------------
   Enquiries (item donations, financial support, questions)
   --------------------------------------------------------- */

const ENQUIRY_INTRO = {
  ITEM_DONATION: 'Thank you for offering to donate items to The Community Pulse Foundation.',
  FINANCIAL: 'Thank you for offering to support The Community Pulse Foundation financially.',
  QUESTION: 'Thank you for getting in touch with The Community Pulse Foundation.',
  OTHER: 'Thank you for getting in touch with The Community Pulse Foundation.'
};

const ENQUIRY_NEXT = {
  ITEM_DONATION:
    'A member of our team will contact you to arrange drop-off or collection, and to confirm what is most needed at the moment.',
  FINANCIAL:
    'Details for sending an Interac e-Transfer are below. If you would prefer another arrangement, simply reply to this email.',
  QUESTION: 'A member of our team will read your message and reply.',
  OTHER: 'A member of our team will read your message and reply.'
};

const ENQUIRY_LABEL = {
  ITEM_DONATION: 'Item donation',
  FINANCIAL: 'Financial support',
  QUESTION: 'Community question',
  OTHER: 'Other'
};

export function enquiryAcknowledgementEmail({ firstName, publicRef, type, donationEmail }) {
  const name = escapeHtml(firstName);
  const ref = escapeHtml(publicRef);

  // Only the financial branch gets transfer details, and they are shown
  // after the acknowledgement rather than as the point of the message -
  // nobody should feel invoiced by a thank-you.
  const transferBlock =
    type === 'FINANCIAL' && donationEmail
      ? `<p style="background:#f8fafb;border-left:4px solid #0d7377;padding:12px 16px;margin:20px 0">
           <strong>Interac e-Transfer</strong><br />
           Send to: <a href="mailto:${escapeHtml(donationEmail)}">${escapeHtml(donationEmail)}</a><br />
           <span style="font-size:13px;color:#636e72">
             The Community Pulse Foundation Inc. is a non-profit organization. We do not
             currently issue official charitable donation receipts for income tax purposes.
           </span>
         </p>`
      : '';

  return {
    subject: 'We have received your message',
    html: WRAP(`
      <p>Hi ${name},</p>

      <p>${escapeHtml(ENQUIRY_INTRO[type] || ENQUIRY_INTRO.OTHER)}</p>

      <p>${escapeHtml(ENQUIRY_NEXT[type] || ENQUIRY_NEXT.OTHER)}</p>

      ${transferBlock}

      <p style="background:#f8fafb;border-left:4px solid #0d7377;padding:12px 16px;margin:20px 0">
        <strong>Your reference:</strong> ${ref}
      </p>

      <p>Please keep this reference for future correspondence. You can reply to this
      email if you need to add anything.</p>
      ${SIGNATURE}
    `)
  };
}

export function enquiryAdminNotificationEmail({ publicRef, firstName, lastName, type, submittedAt, baseUrl }) {
  const ref = escapeHtml(publicRef);
  const name = escapeHtml(`${firstName} ${lastName}`.trim());
  const label = escapeHtml(ENQUIRY_LABEL[type] || type);
  const link = `${baseUrl || ''}/crm/#/enquiries/${encodeURIComponent(publicRef)}`;

  return {
    subject: `New ${label.toLowerCase()} - ${ref}`,
    html: WRAP(`
      <p>A new enquiry has been received.</p>

      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 16px 4px 0;color:#636e72">Reference</td><td><strong>${ref}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#636e72">Type</td><td>${label}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#636e72">From</td><td>${name}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#636e72">Received</td><td>${escapeHtml(submittedAt)}</td></tr>
      </table>

      <p><a href="${escapeHtml(link)}"
            style="background:#0d7377;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;display:inline-block">
        View enquiry
      </a></p>

      <p style="font-size:13px;color:#636e72">Contact details and the full message are on
      the secure record, not in this email.</p>
    `)
  };
}

/**
 * Sent by an administrator once a donation has actually arrived.
 *
 * Deliberately NOT called a receipt anywhere in the wording. The Foundation
 * is incorporated but not a registered charity, so it cannot issue official
 * donation receipts for income tax purposes - and a warm email confirming an
 * amount is exactly the sort of thing someone might otherwise file as one.
 * The disclaimer is not fine print; it sits in the body.
 */
export function fundsReceivedEmail({ firstName, publicRef, amount }) {
  const name = escapeHtml(firstName);
  const ref = escapeHtml(publicRef);

  const amountLine = amount
    ? `<tr><td style="padding:4px 16px 4px 0;color:#636e72">Amount received</td>
           <td><strong>${escapeHtml(amount)}</strong></td></tr>`
    : '';

  return {
    subject: 'Your donation has been received — thank you',
    html: WRAP(`
      <p>Hi ${name},</p>

      <p>We are writing to confirm that your donation to The Community Pulse
      Foundation has been received. Thank you.</p>

      <p>Contributions like yours are what let us keep showing up — collecting and
      delivering essentials to families who need them, running the outreach and
      conversations that help newcomers find their footing, and creating spaces
      where people who might never have met end up looking out for one another.
      Choosing to give away something of your own so that a neighbour has more is
      a genuinely generous act, and we do not take it lightly.</p>

      <table style="border-collapse:collapse;margin:20px 0;background:#f8fafb">
        <tr><td style="padding:10px 16px 4px 0;color:#636e72">Reference</td>
            <td style="padding:10px 0 4px"><strong>${ref}</strong></td></tr>
        ${amountLine}
      </table>

      <p style="font-size:13px;color:#636e72;border-left:3px solid #e2e8f0;padding-left:14px">
        This message confirms that we received your donation. It is not an official
        receipt for income tax purposes — The Community Pulse Foundation Inc. is a
        non-profit organization and does not currently issue charitable tax
        receipts. Please keep this email for your own records.
      </p>

      <p>With appreciation, and on behalf of everyone your gift reaches.</p>
      ${SIGNATURE}
    `)
  };
}

/**
 * Render an admin's optional personal note.
 *
 * Escaped, then newlines restored as breaks - an admin typing three short
 * lines should get three short lines, not one run-on paragraph. Set apart
 * visually so it reads as a message from a person rather than template copy.
 */
function noteBlock(note) {
  const trimmed = (note || '').trim();
  if (!trimmed) return '';

  const body = escapeHtml(trimmed).replace(/\n/g, '<br />');
  return `
    <div style="background:#f8fafb;border-left:4px solid #0d7377;padding:14px 18px;margin:20px 0">
      ${body}
    </div>`;
}

/**
 * Status update for an enquiry, sent only when an admin explicitly asks for it.
 *
 * The copy varies by status and, for REVIEWED, by enquiry type: "we have looked
 * at this" means something quite different to someone offering a sofa than to
 * someone who asked a question. Nothing here promises a timeline we cannot keep,
 * and nothing implies a donation was received - that is a separate, deliberate
 * confirmation (see fundsReceivedEmail).
 */
export function enquiryStatusUpdateEmail({ status, type, firstName, publicRef, note }) {
  const name = escapeHtml(firstName);
  const ref = escapeHtml(publicRef);

  const reviewedBody = {
    ITEM_DONATION: `<p>We have reviewed what you offered to donate. Someone from our
      team will contact you to confirm the details and, if you asked us to collect,
      to arrange a time that works for you.</p>`,
    FINANCIAL: `<p>We have reviewed your message about supporting us financially, and
      someone from our team will be in touch with the next step. If you have already
      sent your contribution, we will confirm separately once it reaches us.</p>`,
    QUESTION: `<p>We have read your question and passed it to the right person on our
      team. You should hear back from us shortly.</p>`,
    OTHER: `<p>We have read your message and passed it to the right person on our
      team. You should hear back from us shortly.</p>`
  };

  const variants = {
    REVIEWED: {
      subject: 'An update on your message',
      body: reviewedBody[type] || reviewedBody.OTHER
    },
    RESPONDED: {
      subject: 'We have replied to you',
      // Doubles as a deliverability check: if our reply went to spam, this
      // tells the person to go looking for it.
      body: `<p>A member of our team has now replied to you directly. That reply
        should be in your inbox - if you cannot find it, please check your spam
        or junk folder, and do let us know if it has not arrived.</p>`
    },
    CLOSED: {
      subject: 'Your message with The Community Pulse Foundation',
      body: `<p>We are marking your message as complete. Thank you for taking the
        time to get in touch with us - it matters more than you might think that
        people in this community reach out, offer what they have, and ask
        questions. If anything else comes up, simply reply to this email and we
        will pick it up from here.</p>`
    }
  };

  const chosen = variants[status];
  if (!chosen) return null;

  return {
    subject: chosen.subject,
    html: WRAP(`
      <p>Hi ${name},</p>

      ${chosen.body}
      ${noteBlock(note)}

      <p style="background:#f8fafb;border-left:4px solid #0d7377;padding:12px 16px;margin:20px 0">
        <strong>Your reference:</strong> ${ref}
      </p>

      <p>Please quote this reference if you get in touch about the same matter.</p>
      ${SIGNATURE}
    `)
  };
}

/**
 * Status update for a volunteer. Same rules: admin-triggered only.
 *
 * ACTIVE is the one that genuinely deserves a warm email - it is the moment
 * someone stops being an applicant and becomes part of the team.
 */
export function volunteerStatusUpdateEmail({ status, firstName, publicRef, note }) {
  const name = escapeHtml(firstName);
  const ref = escapeHtml(publicRef);

  const variants = {
    CONTACTED: {
      subject: 'An update on your volunteer application',
      body: `<p>We have reviewed your volunteer application and someone from our team
        is reaching out to you about it. Thank you for your patience while we worked
        through the details.</p>`
    },
    ACTIVE: {
      subject: 'Welcome to the team',
      body: `<p>You are now an active volunteer with The Community Pulse Foundation.
        Welcome, and thank you.</p>

        <p>Volunteering is a real commitment of time that you could have spent on
        anything else, and choosing to spend it on your neighbours is what makes the
        work we do possible at all. We are glad to have you with us. Someone from our
        team will be in touch about what is coming up and where you can help.</p>`
    },
    APPROVED: {
      subject: 'Your volunteer application has been approved',
      body: `<p>Your volunteer application has been approved. Thank you for your
        patience while we reviewed it.</p>

        <p>Someone from our team will follow up with the practical details - what is
        coming up, what is involved, and where your time would be most useful.</p>`
    },
    DECLINED: {
      // The hardest email here, and the one most worth getting right. No false
      // reasons, no vague corporate softening, and a genuine door left open -
      // this person offered their time to their community and should not be
      // made to feel foolish for having done so.
      subject: 'Your volunteer application',
      body: `<p>Thank you for applying to volunteer with The Community Pulse
        Foundation. After reviewing your application, we are not able to move
        forward with it at this time.</p>

        <p>We know that is disappointing to read. Please understand that it often
        comes down to the roles we happen to have open and what they require, rather
        than anything lacking in what you offered. Deciding to give your time to
        people you may never meet is a good thing to have done, and we would
        genuinely welcome an application from you again in the future.</p>

        <p>If you would like to know more, simply reply to this email and we will
        do our best to answer.</p>`
    }
  };

  const chosen = variants[status];
  if (!chosen) return null;

  return {
    subject: chosen.subject,
    html: WRAP(`
      <p>Hi ${name},</p>

      ${chosen.body}
      ${noteBlock(note)}

      <p style="background:#f8fafb;border-left:4px solid #0d7377;padding:12px 16px;margin:20px 0">
        <strong>Volunteer reference:</strong> ${ref}
      </p>
      ${SIGNATURE}
    `)
  };
}

/**
 * Send an enquiry acknowledgement and record the outcome on the enquiry row.
 *
 * Enquiries track delivery inline rather than in `communications`, since they
 * only ever send one automatic message. Never throws, for the same reason as
 * deliverCommunication: a mail failure must not affect whether the enquiry was
 * accepted.
 */
export async function deliverEnquiryAck(env, enquiryId, { to, subject, html }) {
  const now = new Date().toISOString();

  try {
    await sendMail(env, { to, subject, html });

    await env.DB
      .prepare(
        `UPDATE enquiries
            SET ack_status = 'SENT', ack_attempts = ack_attempts + 1,
                ack_error = NULL, ack_updated_at = ?
          WHERE id = ?`
      )
      .bind(now, enquiryId)
      .run();

    return { ok: true };
  } catch (err) {
    const message = (err && err.message ? err.message : 'unknown_error').slice(0, 300);
    console.error('zoho: enquiry ack failed', { enquiryId, message });

    await env.DB
      .prepare(
        `UPDATE enquiries
            SET ack_status = 'FAILED', ack_attempts = ack_attempts + 1,
                ack_error = ?, ack_updated_at = ?
          WHERE id = ?`
      )
      .bind(message, now, enquiryId)
      .run()
      .catch(() => { /* already logged */ });

    return { ok: false, error: message };
  }
}

/**
 * Format an event's date and time for a human reading an email.
 *
 * Times are stored in UTC and shown in Atlantic time, because that is where
 * the volunteer is standing. Sending someone a UTC timestamp for a shift they
 * have to physically attend is how people miss shifts.
 */
export function formatEventWhen(startsAt, endsAt) {
  const tz = 'America/Moncton';
  const start = new Date(startsAt);
  if (isNaN(start)) return '';

  const day = start.toLocaleDateString('en-CA', {
    timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const from = start.toLocaleTimeString('en-CA', {
    timeZone: tz, hour: 'numeric', minute: '2-digit'
  });

  if (!endsAt) return `${day} from ${from}`;

  const end = new Date(endsAt);
  if (isNaN(end)) return `${day} from ${from}`;

  const to = end.toLocaleTimeString('en-CA', {
    timeZone: tz, hour: 'numeric', minute: '2-digit'
  });

  // A shift that runs past midnight needs the finish date spelled out.
  const endDay = end.toLocaleDateString('en-CA', {
    timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  if (endDay !== day) return `${day}, ${from} until ${endDay}, ${to}`;

  return `${day}, ${from} to ${to}`;
}

/**
 * Tell a volunteer they have been put down for an event.
 *
 * Deliberately not phrased as a summons. The volunteer never agreed to this
 * specific date - an admin assigned them - so the email asks them to confirm
 * and makes saying no easy. Anything else would be presumptuous towards
 * someone donating their time.
 */
export function eventAssignmentEmail({ firstName, event, role, note }) {
  const name = escapeHtml(firstName);
  const title = escapeHtml(event.title);
  const when = escapeHtml(formatEventWhen(event.starts_at, event.ends_at));
  const where = event.location ? escapeHtml(event.location) : '';

  const rows =
    `<tr><td style="padding:10px 16px 4px 0;color:#636e72">What</td>
         <td style="padding:10px 0 4px"><strong>${title}</strong></td></tr>
     <tr><td style="padding:4px 16px 4px 0;color:#636e72">When</td>
         <td>${when}</td></tr>` +
    (where
      ? `<tr><td style="padding:4px 16px 4px 0;color:#636e72">Where</td><td>${where}</td></tr>`
      : '') +
    (role
      ? `<tr><td style="padding:4px 16px 10px 0;color:#636e72">Your role</td>
             <td style="padding-bottom:10px">${escapeHtml(role)}</td></tr>`
      : '');

  return {
    subject: `You are down to help: ${event.title}`,
    html: WRAP(`
      <p>Hi ${name},</p>

      <p>We have put you down to help with the following. Nothing is fixed yet -
      please have a look and let us know whether it works for you.</p>

      <table style="border-collapse:collapse;margin:20px 0;background:#f8fafb">
        ${rows}
      </table>

      ${noteBlock(note)}

      <p>If you can make it, a quick reply saying so is all we need. If you
      cannot, that is completely fine - just tell us and we will find someone
      else. We would much rather know early than have you feel obliged.</p>

      ${event.description ? `<p style="color:#636e72;font-size:14px">${escapeHtml(event.description)}</p>` : ''}

      <p>Thank you for giving your time to this.</p>
      ${SIGNATURE}
    `)
  };
}

/**
 * Tell a volunteer that an event's details have changed.
 *
 * Leads with what is different rather than restating the whole event, because
 * somebody skim-reading needs to catch the change itself. The new details are
 * repeated in full underneath so this email can stand alone as the one they
 * keep.
 */
export function eventChangedEmail({ firstName, event, previous, note }) {
  const name = escapeHtml(firstName);
  const title = escapeHtml(event.title);
  const when = escapeHtml(formatEventWhen(event.starts_at, event.ends_at));

  const changes = [];
  if (previous && previous.starts_at && previous.starts_at !== event.starts_at) {
    changes.push(
      `<li>The time has changed. It was <s>${escapeHtml(formatEventWhen(previous.starts_at, previous.ends_at))}</s> ` +
      `and is now <strong>${when}</strong>.</li>`
    );
  }
  if (previous && previous.location !== undefined && previous.location !== event.location) {
    changes.push(
      `<li>The place has changed to <strong>${escapeHtml(event.location || 'somewhere we will confirm')}</strong>.</li>`
    );
  }

  const rows =
    `<tr><td style="padding:10px 16px 4px 0;color:#636e72">What</td>
         <td style="padding:10px 0 4px"><strong>${title}</strong></td></tr>
     <tr><td style="padding:4px 16px 4px 0;color:#636e72">When</td>
         <td>${when}</td></tr>` +
    (event.location
      ? `<tr><td style="padding:4px 16px 10px 0;color:#636e72">Where</td>
             <td style="padding-bottom:10px">${escapeHtml(event.location)}</td></tr>`
      : '');

  return {
    subject: `Changed details: ${event.title}`,
    html: WRAP(`
      <p>Hi ${name},</p>

      <p>Something has changed about an event you kindly agreed to help with.</p>

      ${changes.length
        ? `<ul style="margin:16px 0;padding-left:20px">${changes.join('')}</ul>`
        : '<p>The details below have been updated.</p>'}

      <table style="border-collapse:collapse;margin:20px 0;background:#f8fafb">
        ${rows}
      </table>

      ${noteBlock(note)}

      <p>If the new time no longer works for you, just tell us - we would far
      rather know now than have you stretch to make it. And apologies for the
      change of plan.</p>
      ${SIGNATURE}
    `)
  };
}

/**
 * Tell a volunteer an event they were assigned to is off.
 *
 * Sent for cancellations only, and worth sending even late: someone who turns
 * up to a cancelled event has given up their afternoon for nothing.
 */
export function eventCancelledEmail({ firstName, event, note }) {
  const name = escapeHtml(firstName);
  const title = escapeHtml(event.title);
  const when = escapeHtml(formatEventWhen(event.starts_at, event.ends_at));

  return {
    subject: `Cancelled: ${event.title}`,
    html: WRAP(`
      <p>Hi ${name},</p>

      <p><strong>${title}</strong>, which was scheduled for ${when}, is no longer
      going ahead. Please do not travel for it.</p>

      ${noteBlock(note)}

      <p>We are sorry for the change of plan, and grateful that you had set the
      time aside. We will be in touch about what is coming up next.</p>
      ${SIGNATURE}
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

/**
 * Queue an enquiry communication and return its row id.
 *
 * Written before the send is attempted so a message that fails mid-flight
 * still leaves a record. `body_preview` is a short excerpt only - the full
 * rendered email is never stored.
 */
export async function queueEnquiryComm(env, { enquiryId, type, to, subject, preview, createdBy }) {
  const now = new Date().toISOString();

  const row = await env.DB
    .prepare(
      `INSERT INTO enquiry_communications
         (enquiry_id, type, to_address, subject, body_preview, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
    )
    .bind(enquiryId, type, to, subject || null, (preview || '').slice(0, 200) || null, createdBy || null, now, now)
    .run();

  return row.meta && row.meta.last_row_id;
}

/**
 * Send a queued enquiry communication and record the outcome.
 * Never throws, for the same reason as deliverCommunication.
 */
export async function deliverEnquiryComm(env, commId, { to, subject, html }) {
  const now = new Date().toISOString();

  try {
    const providerId = await sendMail(env, { to, subject, html });

    await env.DB
      .prepare(
        `UPDATE enquiry_communications
            SET status = 'SENT', provider_id = ?, attempts = attempts + 1,
                error_message = NULL, updated_at = ?
          WHERE id = ?`
      )
      .bind(providerId, now, commId)
      .run();

    return { ok: true };
  } catch (err) {
    const message = (err && err.message ? err.message : 'unknown_error').slice(0, 300);
    console.error('zoho: enquiry comm failed', { commId, message });

    await env.DB
      .prepare(
        `UPDATE enquiry_communications
            SET status = 'FAILED', attempts = attempts + 1,
                error_message = ?, updated_at = ?
          WHERE id = ?`
      )
      .bind(message, now, commId)
      .run()
      .catch(() => { /* already logged */ });

    return { ok: false, error: message };
  }
}
