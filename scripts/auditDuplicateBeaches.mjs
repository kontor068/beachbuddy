/**
 * National duplicate-entry audit (read-only).
 *
 * Surfaced by the pin pipeline: several OSM elements matched a beach of ours
 * while sitting ~0 m from a DIFFERENT beach of ours — the signature of the same
 * beach entered twice under two names.
 *
 * Proximity alone is NOT evidence. Genuinely distinct beaches sit close together
 * all over Greece (Μικρή Βίγλα north/south are separate entries on purpose), so
 * this pairs distance with a name relationship and reports the evidence rather
 * than a verdict.
 *
 * Tiers:
 *   CERTAIN  — <=60 m apart AND one name contains the other (or they normalise
 *              equal). Same sand, same name: a duplicate.
 *   LIKELY   — <=150 m AND a name relationship.
 *   PROXIMITY_ONLY — very close but unrelated names: usually two real beaches
 *              sharing a bay. Reported separately, never auto-actioned.
 *
 * For each pair it also reports which record is RICHER (photos, placeId,
 * amenities, editorial story, curated membership), because if these are ever
 * merged the poorer id is the one to retire — and never blindly the higher id.
 *
 * Run: node scripts/auditDuplicateBeaches.mjs [--json <out>] [--max-m 150]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const OUT = arg('--json', null);
const MAX_M = Number(arg('--max-m', '150'));

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;
const distM = (a, b, c, e) => {
  const dLa = rad(c - a); const dLo = rad(e - b);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const strip = (s) => (s || '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLocaleLowerCase('el')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();
// Words that carry no identity: the island/qualifier noise that makes
// «Μηλιά» and «Αλόννησος Μηλιά» look like different beaches.
const NOISE = /\b(παραλια|beach|ormos|ορμος|plaz|πλαζ|κολπος|akra|nisos|νησος|αλοννησος|alonissos|alonnisos|σκοπελος|skopelos|σαντορινη|santorini|κρητη|creta|crete|παρος|paros|ναξος|naxos)\b/g;
const core = (s) => strip(s).replace(NOISE, ' ').replace(/\s+/g, ' ').trim();

const nameRelation = (a, b) => {
  const ca = core(a); const cb = core(b);
  if (!ca || !cb) return null;
  if (ca === cb) return 'identical_core_name';
  if (ca.includes(cb) || cb.includes(ca)) return 'one_contains_other';
  const wa = new Set(ca.split(' ').filter((w) => w.length > 3));
  const wb = new Set(cb.split(' ').filter((w) => w.length > 3));
  const shared = [...wa].filter((w) => wb.has(w));
  if (shared.length) return `shares_word:${shared.join('+')}`;
  return null;
};

const beachDir = path.join('public', 'data', 'beaches', 'app');
const detailDir = path.join(beachDir, 'detail');

const all = [];
for (const file of readdirSync(beachDir)) {
  if (!file.endsWith('.json') || file === 'index.json' || file === 'search-index.json') continue;
  const regionId = file.replace(/\.json$/, '');
  let beaches = [];
  try { beaches = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8')).island?.beaches || []; } catch { continue; }
  let detail = new Map();
  const dp = path.join(detailDir, `${regionId}.json`);
  if (existsSync(dp)) {
    try {
      const raw = JSON.parse(readFileSync(dp, 'utf8'));
      const list = raw.island?.beaches || raw.beaches || [];
      detail = new Map((Array.isArray(list) ? list : Object.values(list)).filter(Boolean).map((d) => [d.id, d]));
    } catch { /* none */ }
  }
  for (const b of beaches) {
    if (typeof b.coordinates?.lat !== 'number') continue;
    const d = detail.get(b.id) || {};
    all.push({
      id: b.id,
      name: b.name?.gr || b.name?.en || '',
      region: regionId,
      lat: b.coordinates.lat,
      lon: b.coordinates.lon,
      richness: {
        photo: Boolean(b.imageUrl || b.photo || b.images?.length),
        placeId: Boolean(b.googleMapsNavigation?.placeId || b.placeId),
        amenities: Object.values(b.amenities || {}).filter(Boolean).length,
        story: Boolean(d.detailedDescription || d.description),
        aliases: (d.aliases || []).length,
      },
    });
  }
}

const byRegion = new Map();
for (const b of all) {
  if (!byRegion.has(b.region)) byRegion.set(b.region, []);
  byRegion.get(b.region).push(b);
}

const score = (r) => (r.photo ? 4 : 0) + (r.placeId ? 3 : 0) + Math.min(r.amenities, 5) + (r.story ? 2 : 0) + Math.min(r.aliases, 2);

const certain = []; const likely = []; const proximityOnly = [];
for (const [, list] of byRegion) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]; const b = list[j];
      const d = distM(a.lat, a.lon, b.lat, b.lon);
      if (d > MAX_M) continue;
      const rel = nameRelation(a.name, b.name);
      const sa = score(a.richness); const sb = score(b.richness);
      const richer = sa === sb ? null : (sa > sb ? a.id : b.id);
      const row = {
        distanceM: Math.round(d),
        nameRelation: rel,
        a: { id: a.id, name: a.name, score: sa, ...a.richness },
        b: { id: b.id, name: b.name, score: sb, ...b.richness },
        region: a.region,
        richerId: richer,
        poorerId: richer === null ? null : (richer === a.id ? b.id : a.id),
      };
      if (rel && d <= 60 && (rel === 'identical_core_name' || rel === 'one_contains_other')) certain.push(row);
      else if (rel) likely.push(row);
      else proximityOnly.push(row);
    }
  }
}

certain.sort((x, y) => x.distanceM - y.distanceM);
likely.sort((x, y) => x.distanceM - y.distanceM);
proximityOnly.sort((x, y) => x.distanceM - y.distanceM);

// Same core name in the same region at ANY distance. This is the bucket the pin
// audit was really seeing: a duplicate whose second copy also carries a bad pin
// lands kilometres away, so no proximity radius can catch it. It is NOT a verdict
// — sharing a beach name within one island is ordinary in Greece — so each pair
// is reported with the OSM tie-break: whichever member sits on the OSM beach of
// that name is the corroborated one.
const sameNameFar = [];
for (const [regionId, list] of byRegion) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]; const b = list[j];
      if (!core(a.name) || core(a.name) !== core(b.name)) continue;
      const d = distM(a.lat, a.lon, b.lat, b.lon);
      if (d <= MAX_M) continue; // already covered above
      sameNameFar.push({
        region: regionId,
        distanceM: Math.round(d),
        a: { id: a.id, name: a.name, lat: a.lat, lon: a.lon, score: score(a.richness) },
        b: { id: b.id, name: b.name, lat: b.lat, lon: b.lon, score: score(b.richness) },
        resolution: 'unresolved — check which member sits on the OSM beach of this name (scripts/auditPinVsOsm.mjs), then confirm what beach is actually at the other coordinate before merging or deleting',
      });
    }
  }
}
sameNameFar.sort((x, y) => x.distanceM - y.distanceM);

const show = (label, rows, limit) => {
  console.log(`\n${label}: ${rows.length}`);
  rows.slice(0, limit).forEach((r) => {
    console.log(`   ${r.distanceM} m  #${r.a.id} "${r.a.name}" (score ${r.a.score})  <->  #${r.b.id} "${r.b.name}" (score ${r.b.score})  [${r.nameRelation || 'no name link'}]`);
    if (r.richerId) console.log(`        richer: #${r.richerId} — if merged, retire #${r.poorerId}`);
  });
  if (rows.length > limit) console.log(`   … ${rows.length - limit} more`);
};

console.log(`beaches scanned: ${all.length}   pair radius: ${MAX_M} m`);
show('CERTAIN duplicates (<=60 m + same core name)', certain, 40);
show('LIKELY duplicates (name link, <=' + MAX_M + ' m)', likely, 25);
show('PROXIMITY ONLY (close but unrelated names — probably two real beaches)', proximityOnly, 12);

console.log(`\nSAME NAME, FAR APART (same region, >${MAX_M} m): ${sameNameFar.length}`);
sameNameFar.forEach((r) => console.log(
  `   ${r.distanceM} m  #${r.a.id} "${r.a.name}"  <->  #${r.b.id} "${r.b.name}"  [${r.region}]`));
if (sameNameFar.length) {
  console.log('   ^ not a verdict: sharing a beach name within one island is ordinary.');
  console.log('     Resolve by asking which member OSM corroborates, then what is at the other point.');
}

if (OUT) {
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    scanned: all.length, maxM: MAX_M,
    counts: { certain: certain.length, likely: likely.length, proximityOnly: proximityOnly.length, sameNameFar: sameNameFar.length },
    certain, likely, proximityOnly, sameNameFar,
  }, null, 1), 'utf8');
  console.log(`\nwrote ${OUT}`);
}
