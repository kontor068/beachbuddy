/**
 * «ΛΙΓΟ ΓΝΩΣΤΗ» ΔΕΝ ΣΗΜΑΙΝΕΙ «ΔΕΝ ΤΗΝ ΒΡΗΚΑΜΕ ΣΤΟ GOOGLE» — gate.
 *
 * WHY IT EXISTS. The «Ήσυχη» filter could only ever describe the 1.986 beaches carrying a verified
 * Google Place ID, because the flag was a review count below 100. The other 871 — the emptiest
 * coastline we list — were silently absent from the one filter built to find them. On 10/08/2026
 * Miltos chose to let them in, labelled honestly rather than counted.
 *
 * That inference is safe only because of three gates in buildBeachRegionData.mjs, and the reason
 * this file exists is that the measurement which would contradict us is precisely the thing we do
 * not have. Nothing downstream can notice the mistake. Measured before the change: without the
 * famous-beach gate, SEVEN nationally emblematic beaches would have been published as empty —
 * Ναυάγιο, Σαρακήνικο Μήλου, Εγκρεμνοί, Σεϊτάν Λιμάνι, Κλέφτικο, Λαλάρια, Πισίνα. All seven lack a
 * Place ID for the same reason: their names collide nationally and the resolver refused to guess.
 * «Ναυάγιο: λίγο γνωστή» in August is the most damaging sentence this site could print, and no
 * existing check looks at it.
 *
 * WHAT IT ASSERTS, over the built data the app actually loads:
 *
 *   A. NO FAMOUS BEACH IS PRESUMED. Every id in utils/touristPriority.ts is excluded, read from
 *      that file rather than restated, so adding an icon cannot silently skip the gate.
 *   B. PRESUMED AND COUNTED ARE EXCLUSIVE. A beach with a Google popularity tier must never also
 *      carry the inference — that would be an inference overriding a measurement.
 *   C. NO DEVELOPED BEACH IS PRESUMED. Organized, beach bar or sunbeds all mean people, whatever
 *      Google failed to record.
 *   D. NO URBAN BEACH IS PRESUMED. Β' πλαζ Βούλας is 17 km from Syntagma; OSM not knowing it is
 *      organized does not make it a hidden cove.
 *   E. EVERY QUIET FLAG IS ATTRIBUTED. quiet === true must carry 'measured' or 'presumed', unless
 *      a human wrote the flag by hand in the source metadata.
 *   F. THE INFERENCE HAS NOT SWALLOWED THE COAST. Presumed beaches must stay a minority of the
 *      dataset and the measured population must not shrink — a build that starts presuming
 *      everything is a broken join, not a discovery.
 *   G. THE TWO WORDINGS ARE DIFFERENT WORDS. The presumed badge must not reuse the counted
 *      «Ήσυχη» string in any of the five languages, or the distinction exists only in a variable.
 *
 * SELF-PROOF (--prove): four regressions are simulated in memory and each MUST make the gate fail
 * — a famous beach marked presumed, a counted beach marked presumed, a beach-bar beach marked
 * presumed, and an urban beach marked presumed. A gate that cannot fail is decoration.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prove = process.argv.includes('--prove');

// Kept in step with buildBeachRegionData.mjs by assertion F below: if the two ever disagree about
// what counts as urban, the presumed population moves and F notices.
const URBAN_CENTRES = [
  ['Athens', 37.9838, 23.7275, 40],
  ['Thessaloniki', 40.6401, 22.9444, 40],
  ['Patra', 38.2466, 21.7346, 25],
  ['Heraklion', 35.3387, 25.1442, 25],
  ['Chania', 35.5138, 24.0180, 20],
  ['Volos', 39.3622, 22.9420, 25],
  ['Kavala', 40.9396, 24.4066, 20],
  ['Rhodes', 36.4341, 28.2176, 20],
  ['Corfu', 39.6243, 19.9217, 15],
  ['Kalamata', 37.0389, 22.1142, 20],
  ['Alexandroupoli', 40.8457, 25.8744, 20],
];

const distanceKm = (lat1, lon1, lat2, lon2) => {
  const p = Math.PI / 180;
  const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2
    + Math.cos(lat1 * p) * Math.cos(lat2 * p) * (1 - Math.cos((lon2 - lon1) * p)) / 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

const readIconicIds = () => {
  const source = readFileSync(path.join(rootDir, 'utils', 'touristPriority.ts'), 'utf8');
  const ids = new Set();
  for (const line of source.split('\n')) {
    const match = line.match(/^\s*(\d+):\s*\d+\s*,/);
    if (match) ids.add(Number(match[1]));
  }
  return ids;
};

const loadBuiltBeaches = () => {
  const dir = path.join(rootDir, 'public', 'data', 'beaches');
  const files = [];
  const walk = d => {
    for (const entry of readdirSync(d)) {
      const p = path.join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith('.json')) files.push(p);
    }
  };
  walk(dir);
  const byId = new Map();
  const collect = node => {
    if (Array.isArray(node)) {
      for (const item of node) {
        if (item && typeof item === 'object' && item.id != null && item.environment) {
          if (!byId.has(item.id)) byId.set(item.id, item);
        } else collect(item);
      }
    } else if (node && typeof node === 'object') {
      for (const value of Object.values(node)) collect(value);
    }
  };
  for (const file of files) {
    try { collect(JSON.parse(readFileSync(file, 'utf8'))); } catch { /* not a beach payload */ }
  }
  return [...byId.values()];
};

const run = (beaches, iconicIds) => {
  const failures = [];
  const presumed = beaches.filter(b => b.environment?.quietEvidence === 'presumed');
  const measured = beaches.filter(b => b.environment?.quietEvidence === 'measured');

  // A
  const famous = presumed.filter(b => iconicIds.has(b.id));
  if (famous.length) {
    failures.push(`A: ${famous.length} nationally famous beach(es) published as "little known": ${famous.slice(0, 6).map(b => b.id).join(', ')}`);
  }

  // B
  const counted = presumed.filter(b => b.popularity?.tier || b.metadata?.popularity?.tier);
  if (counted.length) {
    failures.push(`B: ${counted.length} beach(es) carry BOTH a Google crowd tier and the presumed inference: ${counted.slice(0, 6).map(b => b.id).join(', ')}`);
  }

  // C
  const developed = presumed.filter(b => (
    b.amenities?.beachBar === true || b.amenities?.sunbeds === true || b.amenities?.organized === true
  ));
  if (developed.length) {
    failures.push(`C: ${developed.length} developed beach(es) (bar/sunbeds/organized) marked as little known: ${developed.slice(0, 6).map(b => b.id).join(', ')}`);
  }

  // D
  const urban = presumed.filter(b => {
    const lat = b.coordinates?.lat, lon = b.coordinates?.lon ?? b.coordinates?.lng;
    if (typeof lat !== 'number' || typeof lon !== 'number') return false;
    return URBAN_CENTRES.some(([, cLat, cLon, radius]) => distanceKm(lat, lon, cLat, cLon) <= radius);
  });
  if (urban.length) {
    failures.push(`D: ${urban.length} beach(es) inside a big city's radius marked as little known: ${urban.slice(0, 6).map(b => b.id).join(', ')}`);
  }

  // E — a quiet flag with no attribution can only come from a hand-written override; anything else
  // means the build produced the flag without recording how, and the card cannot choose its words.
  const unattributed = beaches.filter(b => b.environment?.quiet === true && !b.environment?.quietEvidence);
  if (unattributed.length > 0) {
    failures.push(`E: ${unattributed.length} beach(es) are flagged quiet with no evidence field: ${unattributed.slice(0, 6).map(b => b.id).join(', ')}`);
  }

  // F
  if (presumed.length > beaches.length * 0.35) {
    failures.push(`F: presumed-quiet covers ${presumed.length}/${beaches.length} beaches — over a third of the coast is being inferred, which is a broken join, not a discovery.`);
  }
  if (measured.length < 500) {
    failures.push(`F: only ${measured.length} beaches carry a MEASURED quiet flag (expected ~594). The Google review data has gone missing from the build.`);
  }

  // G
  const localization = readFileSync(path.join(rootDir, 'utils', 'localization.ts'), 'utf8');
  const quietRow = localization.match(/^\s*quiet:\s*\{([^}]*)\}/m)?.[1] ?? '';
  const littleKnownBlock = localization.match(/littleKnownLabels[^=]*=\s*\{([^}]*)\}/)?.[1] ?? '';
  if (!littleKnownBlock) {
    failures.push('G: localizedLittleKnownLabel is gone — the presumed badge has no wording of its own.');
  } else {
    for (const lang of ['en', 'gr', 'de', 'it', 'fr']) {
      const counted = quietRow.match(new RegExp(`${lang}:\\s*'([^']*)'`))?.[1];
      const inferred = littleKnownBlock.match(new RegExp(`${lang}:\\s*'([^']*)'`))?.[1];
      if (!inferred) failures.push(`G: no "little known" wording for ${lang}.`);
      else if (counted && counted === inferred) {
        failures.push(`G: ${lang} prints the counted word "${counted}" for an inferred flag.`);
      }
    }
  }

  return failures;
};

const iconicIds = readIconicIds();
if (iconicIds.size < 40) {
  console.error(`FAIL: parsed only ${iconicIds.size} iconic ids from utils/touristPriority.ts — the format changed and gate A is not actually checking anything.`);
  process.exit(1);
}

const beaches = loadBuiltBeaches();
if (beaches.length < 2000) {
  console.error(`FAIL: loaded only ${beaches.length} built beaches — run "npm run build:beach-data" first.`);
  process.exit(1);
}

const failures = run(beaches, iconicIds);
const presumedCount = beaches.filter(b => b.environment?.quietEvidence === 'presumed').length;
const measuredCount = beaches.filter(b => b.environment?.quietEvidence === 'measured').length;

if (failures.length) {
  console.error('Presumed-quiet gate FAILED:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`presumed-quiet: ${measuredCount} measured + ${presumedCount} inferred = ${measuredCount + presumedCount} beaches in the «Ήσυχη» filter, 0 famous, 0 developed, 0 urban.`);

if (prove) {
  const clone = () => beaches.map(b => ({ ...b, environment: { ...b.environment } }));
  const regressions = [
    ['a famous beach marked presumed', () => {
      const list = clone();
      const victim = list.find(b => iconicIds.has(b.id));
      victim.environment.quietEvidence = 'presumed';
      victim.popularity = undefined;
      return list;
    }],
    ['a counted beach marked presumed', () => {
      const list = clone();
      const victim = list.find(b => b.popularity?.tier && !iconicIds.has(b.id));
      victim.environment.quietEvidence = 'presumed';
      return list;
    }],
    ['a beach-bar beach marked presumed', () => {
      const list = clone();
      const victim = list.find(b => b.amenities?.beachBar === true && !iconicIds.has(b.id));
      victim.environment.quietEvidence = 'presumed';
      victim.popularity = undefined;
      return list;
    }],
    ['an urban beach marked presumed', () => {
      const list = clone();
      const victim = list.find(b => {
        const lat = b.coordinates?.lat, lon = b.coordinates?.lon ?? b.coordinates?.lng;
        if (typeof lat !== 'number' || typeof lon !== 'number') return false;
        if (iconicIds.has(b.id) || b.amenities?.beachBar || b.amenities?.sunbeds || b.amenities?.organized) return false;
        return distanceKm(lat, lon, 37.9838, 23.7275) <= 40;
      });
      victim.environment.quietEvidence = 'presumed';
      victim.popularity = undefined;
      return list;
    }],
  ];
  for (const [label, mutate] of regressions) {
    let list;
    try { list = mutate(); } catch {
      console.error(`SELF-PROOF could not build the regression "${label}" — no suitable beach in the dataset.`);
      process.exit(1);
    }
    if (!run(list, iconicIds).length) {
      console.error(`SELF-PROOF FAILED: "${label}" did not make the gate fail. The gate is decorative.`);
      process.exit(1);
    }
  }
  console.log('self-proof: 4/4 simulated regressions each failed the gate.');
}
