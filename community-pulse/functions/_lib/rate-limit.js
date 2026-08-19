/**
 * Rate limiting for public submission endpoints.
 *
 * Tracks submissions per IP per hour. Turnstile prevents automated bot spam;
 * this prevents a legitimate person or script from overwhelming the system
 * with submissions. Limit is intentionally generous (10/hour) to allow
 * testing and multiple form submissions without frustration.
 */

const LIMITS = {
  volunteers: 10,  // per hour per IP
  enquiries: 10    // per hour per IP
};

/**
 * Check if an IP has exceeded its hourly limit for an endpoint.
 *
 * Returns { allowed: boolean, remaining: number, resetAt: ISO timestamp }
 *
 * If allowed is false, the endpoint should return 429 Too Many Requests.
 * The client can use resetAt to show "try again at" messaging.
 */
export async function checkRateLimit(env, ip, endpoint) {
  const limit = LIMITS[endpoint];
  if (!limit) {
    // Unknown endpoint - allow through rather than blocking on config error
    return { allowed: true, remaining: limit, resetAt: null };
  }

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  const windowStartIso = windowStart.toISOString();
  const windowEndIso = new Date(windowStart.getTime() + 3600000).toISOString();

  try {
    // Check current window
    const current = await env.DB
      .prepare(
        `SELECT submission_count FROM rate_limits
         WHERE ip_address = ? AND endpoint = ? AND window_start = ?`
      )
      .bind(ip, endpoint, windowStartIso)
      .first();

    const count = (current && current.submission_count) || 0;

    if (count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowEndIso
      };
    }

    // Increment or insert
    await env.DB
      .prepare(
        `INSERT INTO rate_limits (ip_address, endpoint, submission_count, window_start, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?, ?)
         ON CONFLICT(ip_address, endpoint, window_start)
         DO UPDATE SET submission_count = submission_count + 1, updated_at = ?`
      )
      .bind(ip, endpoint, windowStartIso, windowStartIso, windowStartIso, windowStartIso)
      .run();

    return {
      allowed: true,
      remaining: limit - (count + 1),
      resetAt: windowEndIso
    };
  } catch (err) {
    console.error('rate-limit check failed', err && err.message);
    // If rate limit check fails, allow through rather than blocking the user
    return { allowed: true, remaining: limit, resetAt: null };
  }
}
