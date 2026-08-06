/**
 * Tourist-weighted photo CANDIDATE finder — proposes, never writes.
 *
 * Why a second harvester: scripts/harvestGeoPhotos.mjs sweeps every missing beach at a
 * tight radius (a photo within ~110-150 m IS that beach, no human needed) and that is the
 * right rule for 1.400 anonymous coves. But it is the wrong rule for the beaches that
 * actually decide whether a visitor trusts us: Balos, Preveli, Vai, Matala have plenty of
 * free-licensed Commons photos — they simply sit 200-600 m from our pin, because the
 * photographer stood on the headland that makes the beach famous. Widening the automatic
 * radius would silently import "near the beach" as "the beach" across the whole country
 * (that is how a pine forest ended up on Schinias, 05/08/2026).
 *
 * So this script does the search and NOTHING else: it ranks the still-missing beaches by
 * popularity, geosearches Commons around each, drops obvious non-beach subjects, and writes
 * the candidates to reports/photo-coverage/famous-candidates.json for a human (or an agent
 * that can actually LOOK at the image) to accept one by one. Nothing reaches
 * data/beachPhotosById.generated.json without that look.
 *
 * Usage: node scripts/proposeFamousBeachPhotos.mjs [topN=40] [radiusM=600]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const PHOTOS = path.join(ROOT, 'data', 'beachPhotosById.generated.json');
const BLOCK = path.join(ROOT, 'data', 'beachPhotoBlocklist.json');
const APP_DIR = path.join(ROOT, 'public', 'data', 'beaches', 'app');
const OUT_DIR = path.join(ROOT, 'reports', 'photo-coverage');
const UA = 'CalmBeachPhotoCandidates/1.0 (https://calmbeach.gr; contact hello@calmbeach.gr)';

const topN = Number(process.argv[2] || 40);
const radius = Math.min(Number(process.argv[3] || 600), 10000);

// Subjects that are demonstrably not the shore. Kept deliberately broad: this list only
// costs us candidates, and a rejected candidate is free while a wrong photo is not.
// Nudity terms lead the list on purpose: the very first run proposed
// "Voidokilia naturists.jpg" for Voidokilia — a correct beach, correctly geotagged, and
// completely unusable on a family-facing page. Location filters cannot catch this; only
// the subject words can, and a human looking at 4.000 pages cannot be the safety net.
const NEG = /(naturist|nudist|nude|naked|topless|fkk|church|chapel|monaster|museum|theatre|theater|castle|fort|acropolis|temple|ruin|tomb|windmill|taverna|restaurant|hotel|room|street|road|sign|map|plan|coat of arms|flag|stamp|coin|book|portrait|statue|mosaic|fresco|icon|butterfl|beetle|insect|spider|snail|lizard|snake|bird|gull|goat|sheep|cat|dog|fish|octopus|squid|crab|jellyfish|flower|orchid|genista|plant|tree|cactus|herb|fungus|lichen|moss|mushroom|food|meal|dish|salad|souvlaki|cocktail|beer|wine|car|bus|boat interior|cockpit|airport|plane|helicopter|panorama of the village|village square|cemetery|grave)/i;

const rj = async p => JSON.parse(await readFile(p, 'utf8'));
const getJson = async url => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const photos = existsSync(PHOTOS) ? await rj(PHOTOS) : {};
const blocked = new Set((existsSync(BLOCK) ? (await rj(BLOCK)).ids : []) || []);
// A file already used for another beach must never be proposed again: one photo, one beach.
const usedFiles = new Set(
  Object.values(photos).flat().map(url => decodeURIComponent(String(url).split('/file/')[1]?.split('&')[0] || '')).filter(Boolean),
);

const beaches = [];
for (const file of readdirSync(APP_DIR)) {
  if (!file.endsWith('.json')) continue;
  const payload = await rj(path.join(APP_DIR, file));
  for (const beach of payload.island?.beaches || []) {
    if (!Number.isInteger(beach.id) || photos[beach.id] || blocked.has(beach.id)) continue;
    if (!beach.coordinates?.lat || !beach.coordinates?.lon) continue;
    beaches.push({
      id: beach.id,
      name: beach.name?.en || beach.name?.gr || String(beach.id),
      nameGr: beach.name?.gr || '',
      region: file.replace(/\.json$/, ''),
      popularity: beach.popularityScore ?? 0,
      lat: beach.coordinates.lat,
      lon: beach.coordinates.lon,
    });
  }
}
beaches.sort((a, b) => b.popularity - a.popularity);
const targets = beaches.slice(0, topN);
console.log(`${beaches.length} beaches still without a photo; proposing candidates for the top ${targets.length} by popularity.`);

const seenThisRun = new Set();
const results = [];
for (const beach of targets) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2'
    + `&generator=geosearch&ggscoord=${beach.lat}%7C${beach.lon}&ggsradius=${radius}&ggslimit=25&ggsnamespace=6`
    + '&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=800';
  let pages = [];
  try {
    const json = await getJson(url);
    pages = json.query?.pages || [];
  } catch (error) {
    console.log(`  ! ${beach.name}: ${error.message}`);
    continue;
  }

  const candidates = [];
  for (const page of pages) {
    const title = String(page.title || '').replace(/^File:/, '');
    if (!/\.(jpe?g|png)$/i.test(title)) continue;
    if (NEG.test(title)) continue;
    if (usedFiles.has(title) || seenThisRun.has(title)) continue;
    const info = page.imageinfo?.[0];
    const licence = info?.extmetadata?.LicenseShortName?.value || '';
    // Commercial-OK free licences only — the site is heading for ads, so NC/ND are out.
    if (!/^(CC0|Public domain|PDM|CC BY [0-9.]+|CC BY-SA [0-9.]+)/i.test(licence.replace(/<[^>]+>/g, ''))) continue;
    candidates.push({
      file: title,
      licence: licence.replace(/<[^>]+>/g, ''),
      author: String(info?.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 120),
      previewUrl: info?.thumburl || info?.url,
      // The URL shape the app stores (Special:Redirect keeps us off direct upload hotlinks).
      storeUrl: `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodeURIComponent(title)}&width=800`,
    });
    if (candidates.length >= 4) break;
  }
  candidates.forEach(candidate => seenThisRun.add(candidate.file));
  results.push({ ...beach, candidates });
  console.log(`  ${beach.name} (${beach.region}) — ${candidates.length} candidate(s)`);
}

await mkdir(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, 'famous-candidates.json');
await writeFile(outPath, `${JSON.stringify({ radius, topN, generated: 'see git log', results }, null, 2)}\n`, 'utf8');
const withAny = results.filter(r => r.candidates.length).length;
console.log(`\nWrote ${path.relative(ROOT, outPath)} — ${withAny}/${results.length} beaches have at least one candidate.`);
console.log('NOTHING was written to data/beachPhotosById.generated.json. Every candidate must be LOOKED AT first.');
