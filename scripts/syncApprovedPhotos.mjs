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
// The rules that decide what goes in it live in ONE place, shared with the
// moderation function: netlify/functions/lib/ugcPhotoIndex.mjs. Read the header
// there before changing anything about credits, ordering or the per-beach cap.
//
// IT ALSO REPUBLISHES THE LIVE INDEX. Since approvals publish themselves the
// moment a moderator clicks (the same map, uploaded to the public bucket), the
// build and the live copy could in principle drift — a bucket upload that failed
// while the row was already approved. Republishing here makes every build a
// self-heal: whatever the site is serving live, after a build it is exactly what
// this script just baked.
//
// TWO RULES OF ITS OWN:
//
// 1. NEVER LEAVE THE SITE WORSE THAN IT FOUND IT. No credentials, no network,
//    an unreadable answer — all exit 0 and leave the committed file untouched.
//    A build must not fail, and photos already live must not vanish, because
//    Supabase was briefly unreachable. That is also what lets a fork or a
//    contributor build this repo with no secrets at all.
//
// 2. AN EMPTY ANSWER IS A REAL ANSWER. Zero approved photos means everything was
//    rejected or nothing has been approved yet, and writing the empty map is how
//    a photo that was un-approved actually disappears from the site. That is not
//    the same as a failed read, which is rule 1 and changes nothing.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildApprovedPhotoIndex,
  publishApprovedPhotoIndex,
} from '../netlify/functions/lib/ugcPhotoIndex.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(projectRoot, 'data', 'beachPhotosUgc.generated.json');

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const skip = (why) => {
  console.log(`[ugc-photos] ${why} — keeping the committed file as it is.`);
  process.exit(0);
};

if (!url || !serviceKey) {
  skip('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
}

const main = async () => {
  const { byBeach, published } = await buildApprovedPhotoIndex({ url, serviceKey });

  await fs.writeFile(OUTPUT, `${JSON.stringify(byBeach, null, 0)}\n`, 'utf8');

  const beaches = Object.keys(byBeach).length;
  console.log(
    published === 0
      ? '[ugc-photos] no approved photos — wrote an empty map.'
      : `[ugc-photos] ${published} approved photo(s) across ${beaches} beach(es).`,
  );

  // Best-effort on purpose. The baked file is already written and is what this
  // build will ship; a bucket that refuses the upload must not fail the build.
  try {
    await publishApprovedPhotoIndex({ url, serviceKey }, byBeach);
    console.log('[ugc-photos] live index republished — the running site matches this build.');
  } catch (error) {
    console.warn(`[ugc-photos] live index not republished — ${error.message}`);
  }
};

main().catch((error) => {
  // Deliberately exit 0: see rule 1 at the top.
  console.warn(`[ugc-photos] sync skipped — ${error.message}`);
  process.exit(0);
});
