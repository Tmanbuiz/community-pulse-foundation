/* =========================================================
   Site-wide middleware
   ---------------------------------------------------------
   Keeps every deployment other than the real domain out of
   search results.

   Cloudflare Pages serves the whole site on
   <project>.pages.dev and on <branch>.<project>.pages.dev as
   well as on the custom domain. Those copies are byte-identical
   and return 200, so a crawler can index them as competing
   duplicates of the real site and split its ranking signals.

   rel="canonical" on each page already points at the custom
   domain, but canonical is a hint a crawler may disregard.
   X-Robots-Tag is a directive it may not. Host is read from
   the request rather than configured, so a new preview branch
   is covered the day it is created without anyone remembering.

   Deliberately does nothing else. Middleware runs on every
   request to the site, so anything expensive or fallible here
   would be paid for on every page load and every API call.
   ========================================================= */

const INDEXABLE_HOSTS = new Set([
  'thecommunitypulsefoundation.ca',
  'www.thecommunitypulsefoundation.ca'
]);

export async function onRequest(context) {
  const response = await context.next();

  let host = '';
  try {
    host = new URL(context.request.url).hostname.toLowerCase();
  } catch {
    // A URL we cannot parse is not one we can vouch for; fall through to
    // adding the header, which is the safe direction to fail in.
  }

  if (INDEXABLE_HOSTS.has(host)) return response;

  // Response objects from the static asset handler can have immutable
  // headers, so build a new one rather than mutating in place.
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
