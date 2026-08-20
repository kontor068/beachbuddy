#!/usr/bin/env node
/**
 * ΠΟΙΕΣ ΠΑΡΑΛΙΕΣ ΤΗΣ ΕΛΛΑΔΑΣ ΕΙΝΑΙ ΟΝΤΩΣ ΣΗΜΕΙΑ KITE/WINDSURF — ΡΩΤΩΝΤΑΣ ΤΟΝ ΧΑΡΤΗ, ΟΧΙ ΤΗ ΜΝΗΜΗ.
 *
 * ΓΙΑΤΙ. Ο κατάλογος `KNOWN_WIND_SPORT_SPOT_IDS` (utils/windProfileOverrides.ts) γράφτηκε
 * χειροκίνητα, από γνώση. Η γνώση δεν έχει όριο που να το ξέρει: δεν μπορούσαμε να πούμε πόσα
 * σημεία μας ξεφεύγουν. Αυτό το εργαλείο δίνει ΑΝΕΞΑΡΤΗΤΗ λίστα υποψηφίων.
 *
 * ΔΕΝ ΓΡΑΦΕΙ ΤΙΠΟΤΑ. Βγάζει αναφορά υποψηφίων για ανθρώπινο έλεγχο — ο κανόνας είναι
 * μονόδρομος προς την προσοχή, οπότε αυτόματη εφαρμογή απαγορεύεται (μνήμη
 * `amenity-reliability-mandate`, και το `activities.surfing` των δεδομένων μας είναι ήδη
 * απόδειξη ότι η αυτόματη εξαγωγή σε αυτό το πεδίο βγάζει σκουπίδια — 543 λάθος εγγραφές).
 *
 * ΤΙ ΡΩΤΑΕΙ ΤΟΝ OSM. Δύο ανεξάρτητα σήματα:
 *   Α. `sport=kitesurfing|windsurfing` — ρητή ταμπέλα αθλήματος.
 *   Β. όνομα που περιέχει kitesurf/windsurf/kiteboard/kite spot κ.λπ. — σχολές, κέντρα, spots.
 * Το Β μόνο του είναι αδύναμο (ένα μαγαζί «Surf Cafe» δεν κάνει την παραλία σημείο), γι' αυτό
 * η αναφορά κρατάει ΧΩΡΙΣΤΑ ποιο σήμα άναψε και σε πόση απόσταση.
 *
 *   node scripts/harvestWindSportSpotsOsm.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpassMirrors, USER_AGENT, sleep } from './lib/placeResolution.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = path.join(root, 'public/data/beaches/app');
const RAW_OUT = path.join(root, 'scripts/data/windsport-osm-raw.json');
const REPORT_OUT = path.join(root, 'reports/weather/windsport-osm-candidates.json');

/** Πόσο μακριά από την πινέζα μας δεχόμαστε ότι το σήμα αφορά ΤΗΝ παραλία. */
const MAX_MATCH_KM = 1.2;
/** Πάνω από αυτό δεν το γράφουμε καν στην αναφορά. */
const REPORT_KM = 2.5;

const NAME_RE = 'kitesurf|kite.?surf|kiteboard|kite.?spot|kite.?school|kite.?center|kite.?centre|kite.?club|windsurf|wind.?surf|surf.?station|surf.?club|surf.?center|surf.?centre';

const AREA_QUERY = `[out:json][timeout:180];
area["ISO3166-1"="GR"][admin_level=2]->.gr;
(
  nwr["sport"~"kitesurfing|windsurfing",i](area.gr);
  nwr["name"~"${NAME_RE}",i](area.gr);
  nwr["name:en"~"${NAME_RE}",i](area.gr);
);
out center tags;`;

const BBOX = '34.7,19.2,41.8,29.8'; // south,west,north,east — Ελλάδα με τα νησιά
const BBOX_QUERY = `[out:json][timeout:180];
(
  nwr["sport"~"kitesurfing|windsurfing",i](${BBOX});
  nwr["name"~"${NAME_RE}",i](${BBOX});
  nwr["name:en"~"${NAME_RE}",i](${BBOX});
);
out center tags;`;

/**
 * ⚠️ ΡΗΤΟ ΟΡΙΟ ΧΡΟΝΟΥ ΚΑΙ ΕΛΕΓΧΟΣ ΠΕΡΙΕΧΟΜΕΝΟΥ, ΚΑΙ ΤΑ ΔΥΟ ΑΠΟ ΠΑΘΗΜΑ.
 * · fetch χωρίς `signal` δεν αποτυγχάνει ποτέ, περιμένει — ένας νεκρός καθρέφτης κόστισε 2 ώρες.
 * · καθρέφτης που απαντάει 200 με άδειο σώμα δεν είναι επιτυχία· μετράμε `elements`, όχι κωδικό.
 */
const fetchOverpass = async (query, label) => {
  for (const mirror of overpassMirrors) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(210_000),
      });
      if (res.status === 429 || res.status === 504 || res.status >= 500) {
        console.warn(`  ${mirror} -> HTTP ${res.status}, επόμενος`);
        await sleep(1500);
        continue;
      }
      const json = await res.json().catch(() => ({}));
      if (Array.isArray(json.elements) && json.elements.length > 0) {
        console.log(`  ${mirror} -> ${json.elements.length} στοιχεία (${label})`);
        return json.elements;
      }
      console.warn(`  ${mirror} -> 200 αλλά ${Array.isArray(json.elements) ? 0 : 'κανένα'} στοιχείο, επόμενος`);
    } catch (err) {
      console.warn(`  ${mirror} απέτυχε: ${err.message}`);
    }
    await sleep(1500);
  }
  return null;
};

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
const distKm = (a, b) => {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const loadBeaches = () => {
  const out = [];
  for (const f of fs.readdirSync(APP_DIR).filter(x => x.endsWith('.json'))) {
    const p = JSON.parse(fs.readFileSync(path.join(APP_DIR, f), 'utf8'));
    for (const b of (p.island?.beaches || [])) {
      const lat = b.coordinates?.lat, lon = b.coordinates?.lon ?? b.coordinates?.lng;
      if (typeof lat !== 'number' || typeof lon !== 'number') continue;
      out.push({ id: b.id, name: b.name?.gr || b.name?.en, region: f.replace(/\.json$/, ''), lat, lon });
    }
  }
  return out;
};

const main = async () => {
  console.log('Overpass: σημεία kite/windsurf στην Ελλάδα (area=GR)…');
  let elements = await fetchOverpass(AREA_QUERY, 'area');
  if (!elements) {
    console.warn('Το area query απέτυχε παντού· δοκιμή με bbox…');
    elements = await fetchOverpass(BBOX_QUERY, 'bbox');
  }
  if (!elements) {
    console.error('Κανένας καθρέφτης δεν απάντησε με δεδομένα. Ξαναδοκίμασε αργότερα.');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(RAW_OUT), { recursive: true });
  fs.writeFileSync(RAW_OUT, JSON.stringify(elements, null, 1));

  const nameRe = new RegExp(NAME_RE, 'i');
  const points = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || '';
    const sportTag = /kitesurfing|windsurfing/i.test(tags.sport || '');
    const nameTag = nameRe.test(name);
    if (!sportTag && !nameTag) continue;
    points.push({
      osm: `${el.type}/${el.id}`, lat, lon, name,
      signal: sportTag && nameTag ? 'sport+name' : sportTag ? 'sport' : 'name',
      sport: tags.sport, leisure: tags.leisure, shop: tags.shop, amenity: tags.amenity, natural: tags.natural,
    });
  }
  console.log(`Χρήσιμα σημεία OSM: ${points.length}`);

  const beaches = loadBeaches();
  console.log(`Παραλίες με συντεταγμένες: ${beaches.length}`);

  const byBeach = new Map();
  for (const pt of points) {
    let best = null;
    for (const b of beaches) {
      const d = distKm(pt, b);
      if (!best || d < best.km) best = { beach: b, km: d };
    }
    if (!best || best.km > REPORT_KM) continue;
    const rec = byBeach.get(best.beach.id) || { ...best.beach, signals: [] };
    rec.signals.push({ ...pt, km: Number(best.km.toFixed(3)) });
    byBeach.set(best.beach.id, rec);
  }

  const rows = [...byBeach.values()].map(r => {
    const near = r.signals.filter(s => s.km <= MAX_MATCH_KM);
    const sportNear = near.filter(s => s.signal !== 'name');
    return {
      id: r.id, name: r.name, region: r.region,
      nearest: Math.min(...r.signals.map(s => s.km)),
      signalsWithin: near.length,
      sportTagged: sportNear.length,
      strength: sportNear.length ? 'ρητή ταμπέλα αθλήματος' : near.length ? 'μόνο όνομα' : 'μακριά (>1,2 χλμ)',
      signals: r.signals.sort((a, b) => a.km - b.km).slice(0, 6),
    };
  }).sort((a, b) => (b.sportTagged - a.sportTagged) || (b.signalsWithin - a.signalsWithin) || (a.nearest - b.nearest));

  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  fs.writeFileSync(REPORT_OUT, JSON.stringify({ checkedAt: new Date().toISOString().slice(0, 10), osmElements: elements.length, usablePoints: points.length, beaches: rows }, null, 2));
  console.log(`\nΠαραλίες με σήμα: ${rows.length}  ·  με ρητή ταμπέλα αθλήματος: ${rows.filter(r => r.sportTagged).length}`);
  console.log(`Αναφορά: ${path.relative(root, REPORT_OUT)}`);
};

main();
