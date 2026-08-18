#!/usr/bin/env node
/**
 * ΤΙ ΔΡΟΜΟΣ ΦΤΑΝΕΙ ΕΚΕΙ — ΓΙΑ ΤΙΣ ΠΑΡΑΛΙΕΣ ΠΟΥ ΛΕΝΕ «ΑΓΝΩΣΤΗ ΠΡΟΣΒΑΣΗ»
 *
 * 455 παραλίες εθνικά κουβαλάνε `access.type: 'unknown'`. Δεν είναι λάθος — είναι το τίμιο
 * αποτέλεσμα του να μη μαντέψουμε. Αλλά ο OSM συχνά ΞΕΡΕΙ τι δρόμο έχει εκεί, και δεν τον
 * έχουμε ρωτήσει· ο υπάρχων auditAccessRoadProximity.mjs κοιτάει την ΑΝΤΙΘΕΤΗ κατεύθυνση
 * (ελέγχει όσες ΔΗΛΩΝΟΥΝ άσφαλτο, μήπως ψεύδονται).
 *
 * ΓΙΑΤΙ Η ΠΥΛΗ ΕΙΝΑΙ ΤΟΣΟ ΣΦΙΧΤΗ. Το `asphalt_road` δεν είναι τεχνική λεπτομέρεια: γίνεται
 * «**Εύκολη πρόσβαση**» στην κάρτα (utils/localization.ts:67) και «περπάτα» στον σχεδιασμό
 * διαδρομής (utils/access.ts:140). Ένας επισκέπτης που το διαβάζει βάζει το αμάξι και πάει.
 * Οπότε άσφαλτος δηλώνεται ΜΟΝΟ με ρητή ετικέτα επιφάνειας ή με δρόμο κατηγορίας που στην
 * Ελλάδα είναι πάντα στρωμένος — ποτέ από `highway=service`/`unclassified` χωρίς `surface`,
 * που στην ύπαιθρο είναι συνήθως χώμα. Ό,τι δεν περνάει τις πύλες μένει «άγνωστη».
 *
 * ΤΑ ΜΟΝΟΠΑΤΙΑ ΔΕΝ ΤΑΞΙΝΟΜΟΥΝΤΑΙ ΕΔΩ. Ένα `highway=path` δίπλα στην παραλία δεν λέει αν
 * κατεβαίνεις με σαγιονάρες ή με σχοινί, και το `hiking_path_easy` είναι εξίσου υπόσχεση με
 * την άσφαλτο. Καταγράφονται στην αναφορά για ανθρώπινο μάτι, δεν προτείνονται.
 *
 * Read-only. Γράφει αναφορά· το scripts/applyAccessFromOsm.mjs εφαρμόζει.
 *
 * Χρήση: node scripts/auditUnknownAccessFromOsm.mjs --regions <id,id> [--radius 200] [--json <out>]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpassMirrors, USER_AGENT, sleep } from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beachDir = path.join(rootDir, 'public', 'data', 'beaches');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const RADIUS = Number(arg('--radius', 200));
const OUT = arg('--json', path.join('reports', 'access-road-proximity', `unknown-access-${new Date().toISOString().slice(0, 10)}.json`));
const regionIds = String(arg('--regions', '')).split(',').map((s) => s.trim()).filter(Boolean);
if (!regionIds.length) {
  console.error('usage: --regions thessaly-skopelos,central-macedonia-halkidiki-mainland');
  process.exit(1);
}

// ── how close a road has to be before it is THIS beach's road ────────────────
// 100 m is roughly "you park and you are on the sand". Beyond it the road may
// serve the headland above, and the walk down is the thing we would be hiding.
const PAVED_M = 100;
const TRACK_M = 150;

// Road classes that are paved in Greece even when OSM forgot the surface tag.
// `unclassified` and `service` are deliberately NOT here: in the countryside they
// are as often dirt as tarmac, and guessing wrong prints «Εύκολη πρόσβαση».
const ALWAYS_PAVED_CLASS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'living_street']);
const DRIVABLE_CLASS = new Set([...ALWAYS_PAVED_CLASS, 'unclassified', 'service']);
const PAVED_SURFACE = new Set(['asphalt', 'paved', 'concrete', 'concrete:plates', 'paving_stones', 'chipseal']);
const UNPAVED_SURFACE = new Set(['dirt', 'ground', 'earth', 'gravel', 'unpaved', 'compacted', 'fine_gravel', 'sand', 'grass', 'rock', 'pebblestone']);

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;
const distM = (aLat, aLon, bLat, bLon) => {
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/**
 * Distance from the pin to the nearest point of a way, not to its centre. A 900 m
 * coastal road whose centroid is 400 m away can still run along the sand, and
 * measuring to the centroid would call that beach roadless.
 */
const project = (lat, lon, lat0) => ({ x: rad(lon) * R * Math.cos(rad(lat0)), y: rad(lat) * R });
const pointSegDist = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
const wayDistM = (lat, lon, geometry) => {
  if (!Array.isArray(geometry) || !geometry.length) return Infinity;
  if (geometry.length === 1) return distM(lat, lon, geometry[0].lat, geometry[0].lon);
  const p = project(lat, lon, lat);
  let best = Infinity;
  for (let i = 1; i < geometry.length; i += 1) {
    const a = project(geometry[i - 1].lat, geometry[i - 1].lon, lat);
    const b = project(geometry[i].lat, geometry[i].lon, lat);
    best = Math.min(best, pointSegDist(p, a, b));
  }
  return best;
};

/**
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΡΗΤΟ ΧΡΟΝΙΚΟ ΟΡΙΟ — ΜΕΤΡΗΜΕΝΟ 17/08/2026.
 *
 * Το `fetch` χωρίς `signal` περιμένει όσο θέλει. Μετρημένο εκείνη τη μέρα, με την ίδια
 * ερώτηση στους τρεις καθρέφτες: overpass-api.de → 504 στα 8,5 δλ · kumi.systems →
 * ΚΑΜΙΑ απάντηση, κρέμασε 60+ δλ · private.coffee → 200 στα 36 δλ. Δηλαδή κάθε παραλία
 * κόστιζε ~107 δευτερόλεπτα, από τα οποία τα 60 ήταν καθαρή αναμονή σε νεκρό καθρέφτη:
 * 34 παραλίες = μία ώρα αντί για δέκα λεπτά. Δεν έσπαγε τίποτα, απλώς δεν τελείωνε ποτέ.
 */
const MIRROR_TIMEOUT_MS = 45000;

const fetchRoads = async (lat, lon, radius) => {
  const q = `[out:json][timeout:40];(way["highway"](around:${radius},${lat},${lon}););out tags geom;`;
  // Τέσσερα περάσματα, όχι ένα — δες την ίδια σημείωση στο scripts/lib/placeResolution.mjs:
  // στις 17/08 βράδυ ο μόνος ζωντανός καθρέφτης απαντούσε 2 στις 6 φορές, οπότε ένα πέρασμα
  // ανά καθρέφτη έβγαζε RETRY στα 2/3 των παραλιών χωρίς πραγματικό λόγο. Άδεια λίστα δρόμων
  // ΔΕΝ ξαναδοκιμάζεται — είναι έγκυρο «κανένας δρόμος εκεί».
  for (let pass = 0; pass < 4; pass += 1) {
    if (pass > 0) await sleep(3000 * pass);
  for (const mirror of overpassMirrors) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
      });
      if (res.status === 429 || res.status === 504 || res.status >= 500) { await sleep(2500); continue; }
      const json = await res.json().catch(() => ({}));
      return (json.elements || []).map((e) => ({
        osm: `way/${e.id}`,
        highway: e.tags?.highway,
        surface: (e.tags?.surface || '').toLowerCase(),
        tracktype: e.tags?.tracktype || '',
        smoothness: e.tags?.smoothness || '',
        name: e.tags?.name || '',
        geometry: e.geometry,
      }));
    } catch { /* next mirror */ }
  }
  }
  return null;
};

const classify = (lat, lon, roads) => {
  const withDist = roads
    .filter((r) => r.highway)
    .map((r) => ({ ...r, distM: Math.round(wayDistM(lat, lon, r.geometry)) }))
    .sort((a, b) => a.distM - b.distM);

  const paved = withDist.filter((r) => (
    r.distM <= PAVED_M &&
    DRIVABLE_CLASS.has(r.highway) &&
    !UNPAVED_SURFACE.has(r.surface) &&
    (PAVED_SURFACE.has(r.surface) || (ALWAYS_PAVED_CLASS.has(r.highway) && !r.surface))
  ));
  if (paved.length) {
    const best = paved[0];
    return {
      verdict: 'asphalt_road',
      label: 'Πρόσβαση με άσφαλτο',
      distM: best.distM,
      evidence: `OSM ${best.osm} highway=${best.highway}${best.surface ? ` surface=${best.surface}` : ' (κατηγορία πάντα στρωμένη)'}${best.name ? ` «${best.name}»` : ''} στα ${best.distM} m`,
    };
  }

  const tracks = withDist.filter((r) => r.highway === 'track' && r.distM <= TRACK_M);
  if (tracks.length) {
    const best = tracks[0];
    const grade = Number(String(best.tracktype).replace('grade', ''));
    const hard = Number.isFinite(grade) ? grade >= 3 : /bad|very_bad|horrible|impassable/.test(best.smoothness);
    return {
      verdict: hard ? 'difficult_dirt_road' : 'passable_dirt_road',
      label: hard ? 'Δύσβατος χωματόδρομος' : 'Βατός χωματόδρομος',
      distM: best.distM,
      evidence: `OSM ${best.osm} highway=track${best.tracktype ? ` tracktype=${best.tracktype}` : ''}${best.smoothness ? ` smoothness=${best.smoothness}` : ''} στα ${best.distM} m`,
    };
  }

  // Reported, never proposed: a path tells you nothing about how hard the descent is.
  const paths = withDist.filter((r) => ['path', 'footway', 'steps', 'bridleway'].includes(r.highway) && r.distM <= TRACK_M);
  const nearestAny = withDist[0];
  return {
    verdict: 'unknown',
    label: null,
    distM: nearestAny?.distM ?? null,
    evidence: paths.length
      ? `μόνο μονοπάτι κοντά (${paths[0].osm} highway=${paths[0].highway} στα ${paths[0].distM} m) — δεν ταξινομείται αυτόματα`
      : nearestAny
        ? `πλησιέστερος δρόμος ${nearestAny.osm} highway=${nearestAny.highway} στα ${nearestAny.distM} m — πολύ μακριά για να είναι ο δρόμος της παραλίας`
        : `κανένας δρόμος στον OSM σε ${RADIUS} m`,
  };
};

const rows = [];
// ΓΡΑΦΕ ΜΕΤΑ ΑΠΟ ΚΑΘΕ ΠΕΡΙΟΧΗ, ΟΧΙ ΣΤΟ ΤΕΛΟΣ — 18/08/2026.
// Ένα εθνικό πέρασμα κρατάει ώρες πάνω σε διακομιστή που πέφτει. Με εγγραφή μόνο στο τέλος,
// ΚΑΘΕ διακοπή (timeout, τερματισμός, πεσμένος Overpass) πετάει ό,τι μαζεύτηκε: μετρημένο εδώ
// τρεις φορές — 29, 8 και 42 παραλίες ρωτήθηκαν και το αποτέλεσμά τους χάθηκε ολόκληρο.
// Η ίδια συμβουλή είναι ήδη γραμμένη στη μνήμη του αγωγού παροχών («γράφε μετά από ΚΑΘΕ
// παραλία ώστε να συνεχίζει από εκεί που έμεινε») και δεν είχε εφαρμοστεί εδώ.
const outPathEarly = path.isAbsolute(OUT) ? OUT : path.join(rootDir, OUT);
mkdirSync(path.dirname(outPathEarly), { recursive: true });
const flush = () => writeFileSync(
  outPathEarly,
  JSON.stringify({ generatedAt: new Date().toISOString(), radiusM: RADIUS, pavedM: PAVED_M, trackM: TRACK_M, partial: true, results: rows }, null, 2) + '\n',
  'utf8',
);

for (const regionId of regionIds) {
  const file = path.join(beachDir, `${regionId}.json`);
  if (!existsSync(file)) { console.error(`άγνωστη περιοχή: ${regionId}`); continue; }
  const beaches = JSON.parse(readFileSync(file, 'utf8'));
  const targets = beaches.filter((b) => {
    const a = b.metadata?.access;
    return !a?.type || a.type === 'unknown';
  });
  console.log(`${regionId}: ${targets.length} με άγνωστη πρόσβαση`);
  for (const b of targets) {
    const roads = await fetchRoads(b.lat, b.lon, RADIUS);
    if (roads === null) {
      rows.push({ id: b.id, name: b.name, regionId, verdict: 'RETRY', evidence: 'Overpass δεν απάντησε' });
    } else {
      const c = classify(b.lat, b.lon, roads);
      rows.push({ id: b.id, name: b.name, regionId, lat: b.lat, lon: b.lon, ...c });
    }
    console.log(`  ${String(rows.at(-1).verdict).padEnd(20)} #${b.id} ${b.name} — ${rows.at(-1).evidence}`);
    // ΜΕΤΑ ΑΠΟ ΚΑΘΕ ΠΑΡΑΛΙΑ, ΟΧΙ ΜΕΤΑ ΑΠΟ ΚΑΘΕ ΠΕΡΙΟΧΗ. Η πρώτη εκδοχή αυτής της διόρθωσης
    // έγραφε ανά περιοχή και ΞΑΝΑΧΑΘΗΚΕ: η Κεφαλονιά έχει δεκάδες άγνωστες και δεν πρόλαβε
    // να τελειώσει μέσα στο όριο χρόνου, οπότε δεν γράφτηκε ποτέ γραμμή. Μια περιοχή μπορεί
    // να κρατήσει περισσότερο από όλο το διαθέσιμο παράθυρο — άρα η μόνη ασφαλής μονάδα
    // είναι η παραλία. (Το ίδιο λέει και η καταγραφή του αγωγού παροχών· εδώ εφαρμόστηκε
    // μισό και κόστισε άλλο ένα χαμένο πέρασμα.)
    flush();
    await sleep(1200);
  }
}

const outPath = outPathEarly;
// τελική εγγραφή χωρίς τη σημαία `partial`, ώστε να φαίνεται ότι το πέρασμα ολοκληρώθηκε
writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), radiusM: RADIUS, pavedM: PAVED_M, trackM: TRACK_M, results: rows }, null, 2) + '\n', 'utf8');

const counts = {};
for (const r of rows) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
console.log(`\n${rows.length} παραλίες → ${JSON.stringify(counts)}`);
console.log(`→ ${path.relative(rootDir, outPath)}`);
