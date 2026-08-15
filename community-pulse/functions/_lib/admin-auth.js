/* =========================================================
   Admin authentication and authorisation
   ---------------------------------------------------------
   Two independent layers, deliberately:

   1. Cloudflare Access sits in front of /admin/* and
      /api/admin/* and decides WHO the caller is.
   2. This file re-verifies that claim server-side and then
      decides WHAT they may do.

   Layer 2 matters because Access protects the edge route, not
   the origin logic. Anything that trusted the header without
   verifying the signature would be trivially spoofable by
   anyone who could reach the Worker directly.

   Required config:
     CF_ACCESS_TEAM_DOMAIN   e.g. "yourteam.cloudflareaccess.com"
     CF_ACCESS_AUD           the Application Audience tag

   Roles come from the admin_users table, not from Access, so
   permissions can change without touching Access policies.
   ========================================================= */

const ROLE_RANK = { VIEWER: 1, COORDINATOR: 2, ADMIN: 3, OWNER: 4 };

// Public signing keys change rarely; cache per isolate.
let cachedKeys = null; // { fetchedAt, keys: Map<kid, CryptoKey> }
const KEY_TTL_MS = 60 * 60 * 1000;

function b64urlToBytes(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function decodeJson(segment) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(segment)));
}

/** Fetch and import Access's public signing keys. */
async function getSigningKeys(teamDomain) {
  const now = Date.now();
  if (cachedKeys && now - cachedKeys.fetchedAt < KEY_TTL_MS) {
    return cachedKeys.keys;
  }

  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('access_certs_unavailable');

  const jwks = await res.json();
  const keys = new Map();

  for (const jwk of jwks.keys || []) {
    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      keys.set(jwk.kid, key);
    } catch {
      // Skip any key we cannot import rather than failing the whole set.
    }
  }

  cachedKeys = { fetchedAt: now, keys };
  return keys;
}

/**
 * Verify the Access JWT and return its claims.
 * Throws on anything suspicious — never returns a partial result.
 */
async function verifyAccessJwt(token, teamDomain, expectedAud) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed_jwt');

  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);

  if (header.alg !== 'RS256') throw new Error('unexpected_alg');

  const keys = await getSigningKeys(teamDomain);
  const key = keys.get(header.kid);
  if (!key) throw new Error('unknown_kid');

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error('bad_signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('token_expired');
  if (payload.nbf && payload.nbf > now + 60) throw new Error('token_not_yet_valid');

  // The audience check is what stops a token minted for some other Access
  // application being replayed against this one.
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!expectedAud || !aud.includes(expectedAud)) throw new Error('bad_audience');

  if (!payload.email) throw new Error('no_email_claim');

  return payload;
}

/**
 * Resolve the caller to an active admin row.
 *
 * Returns { ok: true, actor } or { ok: false, status, error } so callers
 * can respond without try/catch noise.
 */
export async function requireAdmin(context, minimumRole = 'VIEWER') {
  const { request, env } = context;

  if (!env.DB) {
    return { ok: false, status: 500, error: 'server_misconfigured', missing: ['DB'] };
  }

  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
  const expectedAud = env.CF_ACCESS_AUD;

  if (!teamDomain || !expectedAud) {
    // Fail closed. An admin API that silently allows everyone because a
    // variable is unset would be far worse than an outage.
    return {
      ok: false,
      status: 500,
      error: 'server_misconfigured',
      missing: [
        !teamDomain ? 'CF_ACCESS_TEAM_DOMAIN' : null,
        !expectedAud ? 'CF_ACCESS_AUD' : null
      ].filter(Boolean)
    };
  }

  const token =
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    (request.headers.get('Cookie') || '').match(/CF_Authorization=([^;]+)/)?.[1];

  if (!token) {
    return { ok: false, status: 401, error: 'not_authenticated' };
  }

  let claims;
  try {
    claims = await verifyAccessJwt(token, teamDomain, expectedAud);
  } catch (err) {
    console.error('admin-auth: jwt rejected', err && err.message);
    return { ok: false, status: 401, error: 'not_authenticated' };
  }

  const email = String(claims.email).toLowerCase();

  const row = await env.DB
    .prepare('SELECT email, display_name, role, active FROM admin_users WHERE email = ?')
    .bind(email)
    .first();

  // Authenticated by Access but not provisioned here. Treated as a
  // forbidden, not a 401: they are who they say they are, they just have
  // no role. Otherwise the UI would loop them through login forever.
  if (!row || !row.active) {
    return { ok: false, status: 403, error: 'not_authorized' };
  }

  if ((ROLE_RANK[row.role] || 0) < (ROLE_RANK[minimumRole] || 0)) {
    return { ok: false, status: 403, error: 'insufficient_role', role: row.role };
  }

  return {
    ok: true,
    actor: { email: row.email, name: row.display_name, role: row.role }
  };
}

/** Standard JSON response for admin routes. */
export function adminJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Volunteer data must never sit in a shared or browser cache.
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

/** Turn a failed requireAdmin() result into a response. */
export function denied(result) {
  const body = { ok: false, error: result.error };
  if (result.missing) body.missing = result.missing;
  return adminJson(body, result.status);
}

/** Append an audit row. Every state change must call this. */
export async function recordAudit(env, { actor, action, entityType, entityId, before, after }) {
  try {
    await env.DB
      .prepare(
        `INSERT INTO audit_log
           (actor, action, entity_type, entity_id, before_json, after_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        actor,
        action,
        entityType,
        entityId == null ? null : String(entityId),
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        new Date().toISOString()
      )
      .run();
  } catch (err) {
    // An audit write failing should be loud in logs but must not roll back
    // the action the admin already performed.
    console.error('admin-auth: audit write failed', err && err.message);
  }
}
