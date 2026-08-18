/* =========================================================
   Site-wide middleware

   Two jobs, both about what search engines and social
   scrapers see:

   1. Keep every deployment other than the real domain out of
      search results.
   2. Give the CMS-driven pages real <title>, description,
      canonical and Open Graph tags, rendered server-side.

   Deliberately does nothing else. This runs on every request
   to the site, so anything expensive or fallible here is paid
   for on every page load and every API call - hence the cheap
   path guard before any network work, and the rule that any
   failure returns the original response untouched.
   ========================================================= */

const SITE = 'https://thecommunitypulsefoundation.ca';

const INDEXABLE_HOSTS = new Set([
  'thecommunitypulsefoundation.ca',
  'www.thecommunitypulsefoundation.ca'
]);

/* The CMS pages live in Supabase and are rendered client-side by
   page.html. Crawlers that execute JavaScript eventually see the title it
   sets; social scrapers never run JavaScript at all, so a shared link
   previews as a bare URL. Fetching the row here and writing the tags into
   the HTML fixes both.

   This is the anon key, already published in page.html and every other
   page that talks to Supabase - it is designed to be public and is
   restricted by row-level security. Nothing secret is being moved
   server-side by naming it here. */
const SUPABASE_URL = 'https://gbplyifhbniqbapcdlph.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicGx5aWZoYm5pcWJhcGNkbHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjk0MzYsImV4cCI6MjEwMTYwNTQzNn0.xON8mQC7XD7LqHtzvjnQ89ArOAXAuwcNUuxP-qVERYo';

const PAGE_PATHS = new Set(['/page', '/page.html']);
const FETCH_TIMEOUT_MS = 2500;

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Body text -> a plain-prose description, tags and markdown removed.
 *
 * Leading markdown headings are dropped rather than flattened into the
 * prose. Keeping them produced descriptions like "How we started The
 * Community Pulse Foundation was incorporated in..." - the heading running
 * straight into the first sentence with no punctuation, which is what a
 * searcher would have seen under the result.
 */
function toDescription(body) {
  const lines = String(body || '')
    .replace(/<[^>]*>/g, ' ')
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        // Leading list markers are dropped too. Flattened into prose they
        // read as stray punctuation - "...together. - Community outreach" -
        // which looks like a typo in a search result.
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\.\s+/, '')
    )
    .filter((line) => line && !/^#{1,6}\s/.test(line));

  const text = lines
    .join(' ')
    .replace(/[#*_`>[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';
  if (text.length <= 155) return text;
  // Cut at a word boundary so the description never ends mid-word.
  return text.slice(0, 155).replace(/\s+\S*$/, '') + '…';
}

async function loadPage(slug) {
  const query =
    `${SUPABASE_URL}/rest/v1/pages` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&published=eq.true` +
    `&select=slug,title_en,body_en,image_url` +
    `&limit=1`;

  const res = await fetch(query, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/**
 * Write the tags into the served HTML.
 *
 * `published=eq.true` is part of the query above, so an unpublished page
 * yields nothing here and the generic shell is served unchanged - a draft
 * must not leak its title into a share preview.
 */
function injectMeta(html, page, slug) {
  const title = `${page.title_en} | The Community Pulse Foundation`;
  const description = toDescription(page.body_en);
  const canonical = `${SITE}/page?slug=${encodeURIComponent(slug)}`;
  const image = page.image_url || `${SITE}/assets/images/hero-community.jpg`;

  const tags =
    `<link rel="canonical" href="${esc(canonical)}" />\n` +
    (description ? `  <meta name="description" content="${esc(description)}" />\n` : '') +
    `  <meta property="og:type" content="article" />\n` +
    `  <meta property="og:site_name" content="The Community Pulse Foundation Inc." />\n` +
    `  <meta property="og:title" content="${esc(title)}" />\n` +
    (description ? `  <meta property="og:description" content="${esc(description)}" />\n` : '') +
    `  <meta property="og:url" content="${esc(canonical)}" />\n` +
    `  <meta property="og:image" content="${esc(image)}" />\n` +
    `  <meta property="og:locale" content="en_CA" />\n` +
    `  <meta name="twitter:card" content="summary_large_image" />\n` +
    `  <meta name="twitter:title" content="${esc(title)}" />\n` +
    (description ? `  <meta name="twitter:description" content="${esc(description)}" />\n` : '') +
    `  <meta name="twitter:image" content="${esc(image)}" />`;

  return html
    .replace(
      '<title>The Community Pulse Foundation</title>',
      `<title>${esc(title)}</title>`
    )
    .replace('</head>', `  ${tags}\n</head>`);
}

export async function onRequest(context) {
  const { request } = context;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return context.next();
  }

  let response = await context.next();

  /* ---- CMS page meta ---- */
  if (
    request.method === 'GET' &&
    PAGE_PATHS.has(url.pathname) &&
    response.status === 200 &&
    (response.headers.get('Content-Type') || '').includes('text/html')
  ) {
    const slug = url.searchParams.get('slug');
    if (slug) {
      try {
        const page = await loadPage(slug);
        if (page && page.title_en) {
          const html = await response.text();
          response = new Response(injectMeta(html, page, slug), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }
      } catch {
        // Supabase slow, down, or the shape changed. The page still renders
        // its own content client-side, so serving it unmodified is strictly
        // better than failing the request over a missing meta tag.
      }
    }
  }

  /* ---- keep non-production hosts out of the index ---- */
  const host = url.hostname.toLowerCase();
  if (INDEXABLE_HOSTS.has(host)) return response;

  // Static-asset responses can carry immutable headers, so build a new one
  // rather than mutating in place.
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
