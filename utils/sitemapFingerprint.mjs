import { createHash } from 'node:crypto';

/**
 * A fingerprint of what a prerendered page SAYS, for deciding whether its
 * sitemap <lastmod> should move.
 *
 * Shared between scripts/prerenderBeachPages.mjs (which writes the dates) and
 * scripts/validateSitemapLastmod.mjs (which proves the rule still holds). It
 * lives here rather than in either of them so the gate tests the real function
 * instead of a copy that can drift away from it.
 *
 * WHAT IT COVERS, and why only this:
 *   • <title>, <meta name="description">, canonical — what Google prints.
 *   • JSON-LD — the structured facts (amenities, FAQ, breadcrumbs).
 *   • Visible text — what a reader gets.
 *
 * WHAT IT MUST NOT COVER:
 *   • <script>/<link> tags. Vite renames every asset chunk whenever any code
 *     changes, so including them would mark all 9.536 pages as modified on any
 *     code edit — which is exactly the "everything changed today" bug the ledger
 *     exists to end.
 *   • Anything date-shaped. Build timestamps are churn, not content.
 *
 * Truncated to 16 hex chars: 64 bits over ~10k pages, where a collision would
 * cost one stale date rather than anything a visitor could notice.
 */
export const sitemapContentFingerprint = (html) => {
  const source = String(html || '');
  const pick = (re) => (source.match(re) || [])[1] || '';
  const meaningful = [
    pick(/<title>([\s\S]*?)<\/title>/i),
    pick(/<meta name="description" content="([^"]*)"/i),
    pick(/<link rel="canonical" href="([^"]*)"/i),
    (source.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || []).join(''),
    source
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ].join(' ');

  const stable = meaningful
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '')
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return createHash('sha1').update(stable).digest('hex').slice(0, 16);
};
