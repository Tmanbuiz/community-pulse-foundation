/* =========================================================
   GET /sitemap.xml
   ---------------------------------------------------------
   The three fixed pages, plus every published CMS page.

   Generated rather than committed because the CMS pages are
   created in the Site Manager by someone who has no reason to
   know a sitemap exists. A static file would be correct on the
   day it was written and quietly wrong from the next page
   onward.

   If Supabase is unreachable the fixed pages are still served.
   A sitemap missing its CMS entries is a small loss; a sitemap
   that 500s tells search engines the site is broken.
   ========================================================= */

const SITE = 'https://thecommunitypulsefoundation.ca';

const SUPABASE_URL = 'https://gbplyifhbniqbapcdlph.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicGx5aWZoYm5pcWJhcGNkbHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjk0MzYsImV4cCI6MjEwMTYwNTQzNn0.xON8mQC7XD7LqHtzvjnQ89ArOAXAuwcNUuxP-qVERYo';

const FETCH_TIMEOUT_MS = 2500;

// Extensionless, matching the rel="canonical" each page declares. The .html
// forms all 308-redirect, so listing those would point crawlers at addresses
// the site does not serve.
const FIXED = [
  { loc: `${SITE}/`, changefreq: 'monthly', priority: '1.0' },
  { loc: `${SITE}/get-involved`, changefreq: 'monthly', priority: '0.8' },
  { loc: `${SITE}/privacy`, changefreq: 'yearly', priority: '0.3' }
];

function escXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function cmsPages() {
  const query =
    `${SUPABASE_URL}/rest/v1/pages` +
    `?published=eq.true&select=slug&order=slug.asc`;

  const res = await fetch(query, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });

  if (!res.ok) return [];
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((r) => r && typeof r.slug === 'string' && r.slug)
    .map((r) => ({
      loc: `${SITE}/page?slug=${encodeURIComponent(r.slug)}`,
      changefreq: 'monthly',
      priority: '0.6'
    }));
}

export async function onRequestGet() {
  let entries = FIXED;

  try {
    entries = FIXED.concat(await cmsPages());
  } catch {
    // Serve the fixed pages rather than nothing.
  }

  const today = new Date().toISOString().slice(0, 10);

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        (e) =>
          `  <url>\n` +
          `    <loc>${escXml(e.loc)}</loc>\n` +
          `    <lastmod>${today}</lastmod>\n` +
          `    <changefreq>${e.changefreq}</changefreq>\n` +
          `    <priority>${e.priority}</priority>\n` +
          `  </url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
