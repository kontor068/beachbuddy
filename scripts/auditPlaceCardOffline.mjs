/**
 * Does the «Οδηγίες» button open THIS beach? — answered without a Google API key.
 *
 * WHY. Verifying navigation used to mean a paid Places call per beach
 * (scripts/auditGooglePlaceRouting.mjs). The key is closed. But everything the question
 * needs is already on disk:
 *
 *   • Beaches routed by COORDINATES (and the ones with no nav block, which the app also
 *     routes by coordinate — utils/navigation.ts getDirectionsDestination) open the map at
 *     our own pin. "Right beach" therefore means "right pin", and the national OSM harvest
 *     (scripts/data/osm-beaches-national.json) says whether a named beach sits under it.
 *
 *   • Beaches routed by a PLACE ID open one specific Google card. The cached Places answer
 *     (reports/place-resolution/google-upgrade.json) carries, per placeId, the card's own
 *     name, type and coordinates. Distance from our pin to the card, plus whether the card's
 *     name is our beach's name, is the whole check — no call, no bill.
 *
 * THE TRAP THIS AVOIDS. Distance alone lies twice. A card 1.2 km away can be the right one
 * (Ελαφονήσι, Πλάκα Νάξου, Φαλάσαρνα are kilometres long; both pins are on the sand), and a
 * far pin on an id ≥ 3000 beach is expected, not wrong: those were added precisely because
 * OSM holds them only as anonymous polygons, so no NAMED harvest entry can be near them.
 * So a far place card is only WRONG when its name is a different beach's name, and a far
 * pin is only flagged when the record predates the anonymous-polygon inserts.
 *
 * Verdicts for place cards:
 *   OK        card ≤ 400 m, beach-like type
 *   LONG      card > 400 m but same name (a long beach) — nothing to do
 *   SECTION   one name contains the other («Σούγια (γυμνιστών)» → «Παραλία Σούγια») — same beach
 *   WRONG     card > 400 m AND a different name — the button opens another beach
 *   UNCACHED  placeId not in the cached answer — cannot be judged offline
 *
 * Greek inflection is folded (Νικήτης/Νικήτη, Κέρος/Κέρους) and Latin card names are
 * transliterated before comparing. Anything still ambiguous prints for a human; the script
 * never guesses a name.
 *
 * Report-only. `--fix` reverts WRONG cards to coordinate routing (the button stays, it just
 * stops opening a foreign card) with a dated sourceNote. Scoped runs write `*-partial.json`.
 *
 * Run:  node scripts/auditPlaceCardOffline.mjs [--region <regionId,...>] [--far 400] [--fix]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : fallback;
};
const FIX = process.argv.includes('--fix');
const FAR_M = Number(arg('--far', 400));
const regionArg = arg('--region', '');
const regionFilter = regionArg ? new Set(regionArg.split(',').map((s) => s.trim()).filter(Boolean)) : null;
const TODAY = new Date().toISOString().slice(0, 10);

// --- evidence ------------------------------------------------------------------------
const summaryDir = path.join(rootDir, 'public', 'data', 'beaches', 'app', 'summary');
const cachedRaw = JSON.parse(fs.readFileSync(path.join(rootDir, 'reports', 'place-resolution', 'google-upgrade.json'), 'utf8'));
const cachedRows = Array.isArray(cachedRaw) ? cachedRaw : Object.values(cachedRaw).find((v) => Array.isArray(v));
const cardByPlaceId = new Map();
for (const r of cachedRows) if (r.placeId && r.top?.loc) cardByPlaceId.set(r.placeId, r);

const harvestRaw = JSON.parse(fs.readFileSync(path.join(rootDir, 'scripts', 'data', 'osm-beaches-national.json'), 'utf8'));
const harvest = (Array.isArray(harvestRaw) ? harvestRaw : Object.values(harvestRaw).find((v) => Array.isArray(v)))
  .filter((o) => o.coordinates && o.name);

// --- geometry & names ----------------------------------------------------------------
const R = 6371000;
const RAD = Math.PI / 180;
const distanceM = (a, b) => {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const GR2LAT = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'i', φ: 'f', χ: 'h', ψ: 'ps', ω: 'o' };
// One comparable form for Greek or Latin names: no accents, no «Παραλία»/«beach», no
// parenthetical qualifiers, digraphs folded, Greek transliterated the same way a Latin
// card name would already be written, and the common genitive endings trimmed so
// Νικήτης ≈ Νικήτη ≈ Nikiti.
// Generic words that name the kind of place, not the place. Removed AFTER transliteration,
// because JavaScript's \b only knows ASCII letters — a `\bπαραλια\b` never matches, which
// silently left «Παραλία» inside every Greek card name and made them all look different.
const STOP_WORDS = new Set(['paralia', 'beach', 'akti', 'ormos', 'nea', 'neas', 'neo', 'neou']);
const fold = (value) => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\(.*?\)/g, ' ')
  .replace(/ευ/g, 'ef').replace(/αυ/g, 'af')
  .replace(/ου/g, 'ou').replace(/ει/g, 'i').replace(/οι/g, 'i').replace(/αι/g, 'e')
  .replace(/μπ/g, 'b').replace(/ντ/g, 'd').replace(/γκ/g, 'g').replace(/γγ/g, 'ng')
  .split('').map((c) => GR2LAT[c] ?? c).join('')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .split(/\s+/)
  // Stop words are matched on the plain transliteration, BEFORE the Latin digraph folds
  // below: folding first turned «beach» into «beah», which no stop list contains.
  .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
  .map((w) => w.replace(/ch/g, 'h').replace(/ph/g, 'f').replace(/y/g, 'i').replace(/ou/g, 'u'))
  .map((w) => w.replace(/(ou|as|is|es|os|ias|ion|on|a|i|s|u)$/, ''))
  .filter(Boolean);

// Two words are the same word when the shorter is a prefix of the longer and the tail is
// at most three letters: that is what a Greek case ending or a Latin -s looks like after
// folding (Κέρος/Κέρους, Πλατανιάς/Πλατανιά, Καλλικράτειας/Καλλικράτεια). Anything longer
// than three is a different word, not an inflection.
const sameWord = (x, y) => {
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.startsWith(short) && long.length - short.length <= 3;
};
const nameRelation = (ours, theirs) => {
  const a = fold(ours);
  const b = fold(theirs);
  if (!a.length || !b.length) return 'different';
  const aIn = a.every((w) => b.some((v) => sameWord(w, v)));
  const bIn = b.every((w) => a.some((v) => sameWord(w, v)));
  if (aIn && bIn) return 'same';
  if (aIn || bIn) return 'section';
  return 'different';
};

const BAD_CARD_TYPE = /lodging|hotel|restaurant|bar|cafe|store|parking|resort|car_/;

// --- walk ------------------------------------------------------------------------------
const files = fs.readdirSync(summaryDir).filter((f) => f.endsWith('.json'));
const placeRows = { ok: [], long: [], section: [], wrong: [], uncached: [], badType: [], nearDifferentName: [] };
const pinRows = { on: 0, near: 0, far: [] };
let scanned = 0;

for (const file of files) {
  const regionId = file.replace(/\.json$/, '');
  if (regionFilter && !regionFilter.has(regionId)) continue;
  const data = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8'));
  for (const b of data.island?.beaches ?? []) {
    scanned += 1;
    const pin = b.coordinates || { lat: b.lat, lon: b.lon };
    const nav = b.metadata?.googleMapsNavigation;
    const base = { regionId, id: b.id, name: b.name?.gr || b.name?.en };

    if (nav?.mode === 'place' && nav.placeId) {
      const card = cardByPlaceId.get(nav.placeId);
      if (!card) { placeRows.uncached.push(base); continue; }
      const d = Math.round(distanceM(pin, card.top.loc));
      const row = { ...base, placeId: nav.placeId, card: card.top.name, cardType: card.top.primaryType || '', distanceM: d };
      if (BAD_CARD_TYPE.test(row.cardType) && !/beach/.test(row.cardType)) { placeRows.badType.push(row); continue; }
      const rel = nameRelation(row.name, row.card);
      if (d <= FAR_M) {
        // Near but named after another beach: two coves 300 m apart sharing one card (Γιαλού
        // Χωράφι holding «Παραλία Φραγκολιμιώνα»). Not auto-fixed — adjacent beaches often
        // share a Google listing legitimately — but never silently OK either.
        if (rel === 'different') placeRows.nearDifferentName.push(row);
        else placeRows.ok.push(row);
        continue;
      }
      if (rel === 'same') placeRows.long.push(row);
      else if (rel === 'section') placeRows.section.push(row);
      else placeRows.wrong.push(row);
      continue;
    }

    // Coordinate-routed or no nav block: the pin is the destination.
    let best = { d: Infinity, name: '' };
    for (const o of harvest) {
      const d = distanceM(pin, o.coordinates);
      if (d < best.d) best = { d, name: o.name };
    }
    if (best.d <= 150) pinRows.on += 1;
    else if (best.d <= FAR_M) pinRows.near += 1;
    else pinRows.far.push({ ...base, mode: nav?.mode || 'none', nearestOsm: best.name, distanceM: Math.round(best.d), anonymousInsert: b.id >= 3000 });
  }
}

// --- report ----------------------------------------------------------------------------
const outDir = path.join(rootDir, 'reports', 'place-resolution');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `place-card-offline-${TODAY}${regionFilter ? '-partial' : ''}.json`);
fs.writeFileSync(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), partial: Boolean(regionFilter), regions: regionFilter ? [...regionFilter] : 'all', farM: FAR_M, scanned, place: placeRows, pin: pinRows }, null, 2)}\n`, 'utf8');

const line = (r) => `  ${r.regionId.padEnd(38)} #${String(r.id).padEnd(5)} «${r.name}» → «${r.card}» ${r.distanceM} m`;
console.log(`Scanned ${scanned} beaches${regionFilter ? ` in ${regionFilter.size} region(s)` : ''}.`);
console.log(`\nPLACE CARDS (offline, from the cached Google answer)`);
console.log(`  OK ≤${FAR_M} m: ${placeRows.ok.length}   LONG beach, same name: ${placeRows.long.length}   SECTION of same beach: ${placeRows.section.length}   uncached: ${placeRows.uncached.length}`);
console.log(`  WRONG — the button opens a differently-named beach: ${placeRows.wrong.length}`);
placeRows.wrong.forEach((r) => console.log(line(r)));
if (placeRows.badType.length) {
  console.log(`  WRONG TYPE — the card is a business, not a beach: ${placeRows.badType.length}`);
  placeRows.badType.forEach((r) => console.log(`${line(r)} [${r.cardType}]`));
}
if (placeRows.nearDifferentName.length) {
  console.log(`  NEAR but a DIFFERENT name — a human decides (adjacent coves may share one listing): ${placeRows.nearDifferentName.length}`);
  placeRows.nearDifferentName.forEach((r) => console.log(line(r)));
}
console.log(`\nPINS (coordinate-routed or no nav block — the pin is the destination)`);
console.log(`  on a named OSM beach ≤150 m: ${pinRows.on}   within ${FAR_M} m: ${pinRows.near}   farther: ${pinRows.far.length}`);
const realFar = pinRows.far.filter((r) => !r.anonymousInsert);
console.log(`  of the far ones, ${pinRows.far.length - realFar.length} are id ≥ 3000 (added from anonymous OSM polygons — expected).`);
if (realFar.length) {
  console.log(`  SUSPECT pins (older records with no named OSM beach nearby — verify with stage 3 before touching):`);
  realFar.forEach((r) => console.log(`  ${r.regionId.padEnd(38)} #${String(r.id).padEnd(5)} «${r.name}» nearest «${r.nearestOsm}» ${r.distanceM} m`));
}
console.log(`\n→ ${path.relative(rootDir, outPath)}`);

// --- fix -------------------------------------------------------------------------------
if (FIX && placeRows.wrong.length) {
  const wrongById = new Map(placeRows.wrong.map((r) => [r.id, r]));
  const srcPath = path.join(rootDir, 'public', 'greek_beaches.json');
  const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  let fixed = 0;
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const b of node) {
        const row = b && wrongById.get(b.id);
        if (!row) continue;
        const nav = b.metadata?.googleMapsNavigation;
        if (!nav || nav.mode !== 'place' || nav.placeId !== row.placeId) continue;
        b.metadata.googleMapsNavigation = {
          status: 'verified', mode: 'coordinates', checkedAt: TODAY, method: 'offline-place-card-check-v1',
          reason: `placeId ${row.placeId} removed ${TODAY}: the cached Google answer for this card is «${row.card}», a differently-named beach ${row.distanceM} m from our pin, so the button opened another beach. Reverted to coordinate routing; the button stays.`,
        };
        b.metadata.sourceNotes = Array.isArray(b.metadata.sourceNotes) ? b.metadata.sourceNotes : [];
        b.metadata.sourceNotes.push(`Navigation ${TODAY}: Google place card opened «${row.card}» (${row.distanceM} m away, different name) — checked offline against the cached Google Places answer, no API call. Dropped to coordinate routing. Pin unchanged.`);
        fixed += 1;
      }
      return;
    }
    if (node && typeof node === 'object') for (const k of Object.keys(node)) walk(node[k]);
  };
  walk(raw);
  fs.writeFileSync(srcPath, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`\nFIXED ${fixed} wrong cards → coordinate routing. Run: npm run build:beach-data`);
} else if (FIX) {
  console.log('\nNothing to fix.');
} else if (placeRows.wrong.length) {
  console.log('\n(dry run — pass --fix to revert WRONG cards to coordinate routing)');
}
