#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// THE LAST MILE — approved photo → the beach card.
//
// Before this script the contribution pipeline stopped one step short of being
// real: netlify/functions/lib/ugcModeration.mjs copies an approved photo into
// the PUBLIC bucket, stamps `public_path`, and raises a "needs publishing" flag
// — and nothing anywhere read that flag or rendered the photo. Everything a
// visitor sent sat in a queue nobody could see the end of, while the landing
// page promised «θα τη δεις στην κάρτα της παραλίας».
//
// This runs as part of `npm run build`, reads the approved rows, and writes
// data/beachPhotosUgc.generated.json — the file services/beachPhotos.ts and the
// prerenderer both consult BEFORE the Commons library.
//
// FOUR RULES:
//
// 1. NEVER LEAVE THE SITE WORSE THAN IT FOUND IT. No credentials, no network,
//    an unreadable answer — all exit 0 and leave the committed file untouched.
//    A build must not fail, and photos already live must not vanish, because
//    Supabase was briefly unreachable. That is also what lets a fork or a
//    contributor build this repo with no secrets at all.
//
// 2. A PHOTO WITH NO NAME ON IT IS STILL PUBLISHED, BUT NEVER MISATTRIBUTED.
//    The credit comes from profiles.display_name and is SHORTENED to «Γιώργος
//    Π.» — we promised the uploader their name on the card, not that we would
//    publish their full legal name on a page Google indexes forever. Two things
//    produce `credit: null`, and both mean the site says "from a visitor" in the
//    reader's language: no profile name on record, and `show_credit = false`,
//    which is the uploader ticking the box off in the form (migration 0003).
//
// 3. ONLY `approved` + `public_path`. An approved row whose file never reached
//    the public bucket is skipped, not guessed at: the private object is not
//    publicly readable, so a URL built from `storage_path` would be a 400 on
//    every beach card that showed it.
//
// 4. NEWEST FIRST, CAPPED PER BEACH. The card shows one photo and the detail
//    page a handful; an unbounded list would let one enthusiastic uploader own
//    a beach page. Six is the same ceiling the detail gallery already uses.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(projectRoot, 'data', 'beachPhotosUgc.generated.json');

const PUBLIC_BUCKET = 'beach-photos-public';
const MAX_PER_BEACH = 6;

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const skip = (why) => {
  console.log(`[ugc-photos] ${why} — keeping the committed file as it is.`);
  process.exit(0);
};

if (!url || !serviceKey) {
  skip('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
}

const authHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  Accept: 'application/json',
};

const getJson = async (pathAndQuery) => {
  const response = await fetch(`${url}/rest/v1/${pathAndQuery}`, { headers: authHeaders });
  if (!response.ok) {
    throw new Error(`${pathAndQuery} → ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return response.json();
};

/**
 * «Γιώργος Παπαδόπουλος» → «Γιώργος Π.»
 *
 * A single-word name is left alone (there is no surname to reduce), and anything
 * that is not a plain name — an email address slipped into the Google profile,
 * an empty string — returns null rather than being printed on a public page.
 */
const shortenName = (raw) => {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!name || name.includes('@') || name.length > 60) return null;
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0];
  const surname = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(' ')} ${surname.charAt(0).toUpperCase()}.`;
};

const main = async () => {
  const photos = await getJson(
    'beach_photos?status=eq.approved&public_path=not.is.null'
    + '&select=beach_id,region_id,public_path,caption,width,height,user_id,approved_at,show_credit'
    + '&order=approved_at.desc',
  );

  if (!Array.isArray(photos)) skip('unexpected answer from beach_photos');
  if (photos.length === 0) {
    // An empty result is a REAL answer, not a failure: it means everything was
    // rejected or nothing has been approved yet. Writing the empty map is how a
    // photo that was un-approved actually disappears from the site.
    await fs.writeFile(OUTPUT, `${JSON.stringify({}, null, 0)}\n`, 'utf8');
    console.log('[ugc-photos] no approved photos — wrote an empty map.');
    return;
  }

  // One request for every name, rather than one per photo.
  const userIds = [...new Set(photos.map(row => row.user_id).filter(Boolean))];
  let namesById = new Map();
  try {
    const profiles = await getJson(`profiles?id=in.(${userIds.join(',')})&select=id,display_name`);
    namesById = new Map((profiles || []).map(p => [p.id, shortenName(p.display_name)]));
  } catch (error) {
    // Credits are worth a degraded mode, not a failed build: the photos still
    // publish, attributed to "a visitor" instead of by name.
    console.warn(`[ugc-photos] could not read profiles (${error.message}); publishing without names.`);
  }

  const byBeach = {};
  let published = 0;
  for (const row of photos) {
    const beachId = String(row.beach_id ?? '');
    if (!beachId || !row.public_path) continue;
    const list = (byBeach[beachId] ||= []);
    if (list.length >= MAX_PER_BEACH) continue;

    list.push({
      // Public bucket ⇒ a permanent, unsigned URL. Signed URLs expire, and a
      // static page baked with one serves a dead image days later.
      url: `${url}/storage/v1/object/public/${PUBLIC_BUCKET}/${row.public_path.split('/').map(encodeURIComponent).join('/')}`,
      // `show_credit === false` is the uploader saying "publish it, but not my
      // name". Honoured here rather than in the UI, so the choice survives into
      // the baked static pages too — a byline nobody asked for cannot be
      // quietly corrected once Google has crawled it.
      credit: row.show_credit === false ? null : (namesById.get(row.user_id) || null),
      caption: (row.caption || '').trim() || null,
      width: Number(row.width) || null,
      height: Number(row.height) || null,
    });
    published += 1;
  }

  await fs.writeFile(OUTPUT, `${JSON.stringify(byBeach, null, 0)}\n`, 'utf8');
  console.log(`[ugc-photos] ${published} approved photo(s) across ${Object.keys(byBeach).length} beach(es).`);
};

main().catch((error) => {
  // Deliberately exit 0: see rule 1 at the top.
  console.warn(`[ugc-photos] sync skipped — ${error.message}`);
  process.exit(0);
});
