/**
 * Stage 2b of the pin audit: what to do when OSM has NO beach polygon near our pin.
 *
 * scripts/verifyPinDisplacement.mjs resolves a flagged pin by measuring it against
 * the beach polygon OSM already has. That fails for the rows the placement audit
 * marks `NO_BEACH_IN_RADIUS`: there is no polygon to measure against, so the pin
 * stays "confirmed wrong" forever with no target to move it to.
 *
 * Two different things hide behind NO_BEACH_IN_RADIUS and they need opposite fixes:
 *
 *   a) the pin is fine and OSM simply has not mapped that beach — common for the
 *      small coves the hidden-beach discovery pass added. Nothing to do.
 *   b) the pin is genuinely somewhere else, and the beach IS in OSM under its own
 *      name a few kilometres away — the case that sends a visitor to the wrong bay.
 *
 * Telling them apart needs a NAME search, not a proximity search. So: one Overpass
 * call per beach over a wide radius, collecting every named beach/bay/place, then
 * matched against our name and its aliases. A confident name hit far from our pin
 * is case (b) and produces a MOVE with the OSM coordinate as the target.
 *
 * Read-only. Emits a report in the shape scripts/applyPinMoves.mjs consumes.
 *
 * Run: node scripts/findPinTargetsByName.mjs --ids 2652,2656 [--radius 20000] [--json <out>]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpassMirrors, USER_AGENT, sleep, normalizeText } from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const RADIUS = Number(arg('--radius', 20000));
const OUT = arg('--json', path.join('reports', 'pin-name-targets.json'));
// A name hit closer than this to our pin means the pin is already on the right
// beach — OSM just tags it as a node with no polygon. Not a move.
const SAME_PLACE_M = 250;

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;
const distM = (aLat, aLon, bLat, bLon) => {
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// ── name matching ────────────────────────────────────────────────────────────
// Greek beach names arrive in five spellings for the same sand: with and without
// accents, with «Παραλία» in front, in the genitive, transliterated, and in the
// English the tourist signs use. Comparing raw strings finds none of them.
const ACCENTS = { ά: 'α', έ: 'ε', ή: 'η', ί: 'ι', ό: 'ο', ύ: 'υ', ώ: 'ω', ϊ: 'ι', ϋ: 'υ', ΐ: 'ι', ΰ: 'υ' };
const strip = (s) => String(s || '')
  .toLowerCase()
  .replace(/[άέήίόύώϊϋΐΰ]/g, (c) => ACCENTS[c] || c)
  .replace(/\b(παραλια|beach|plaz|πλαζ)\b/g, ' ')
  .replace(/[^a-zα-ω0-9]+/g, ' ')
  .trim();
// Greek nouns change their ending, not their stem: Καστάνη / Καστάνης / Καστανίου.
const stem = (s) => strip(s).split(' ').filter(Boolean).map((w) => w.replace(/(ς|υ|ου|ων|ας|ης|ος|ον|α|ε|ι|ο|υ)$/, '')).join(' ');
const nameMatches = (ours, theirs) => {
  const a = strip(ours), b = strip(theirs);
  if (!a || !b) return false;
  if (a === b) return true;
  const sa = stem(ours), sb = stem(theirs);
  if (sa && sa === sb) return true;
  // One name containing the other, whole-word, is a match: "Πλάκα" vs "Πλάκα Σκοπέλου".
  const words = (x) => new Set(x.split(' ').filter(Boolean));
  const wa = words(a), wb = words(b);
  if (wa.size && [...wa].every((w) => wb.has(w))) return true;
  if (wb.size && [...wb].every((w) => wa.has(w))) return true;
  return false;
};

const fetchNamedPlaces = async (lat, lon, radius) => {
  // Beaches first, but bays and hamlets carry the name too when the sand itself
  // is unmapped — a named bay is a defensible target, a random node is not.
  const q = `[out:json][timeout:60];(` +
    `node["natural"="beach"]["name"](around:${radius},${lat},${lon});` +
    `way["natural"="beach"]["name"](around:${radius},${lat},${lon});` +
    `node["natural"="bay"]["name"](around:${radius},${lat},${lon});` +
    `node["place"~"locality|hamlet|village"]["name"](around:${radius},${lat},${lon});` +
    `);out tags center 400;`;
  for (const mirror of overpassMirrors) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        // Χωρίς αυτό, ένας νεκρός καθρέφτης κρεμάει την κλήση επ' άπειρον — μετρημένο
        // 17/08/2026: kumi.systems δεν απαντούσε καθόλου και κόστιζε 60 δλ ανά παραλία.
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(45000),
      });
      if (res.status === 429 || res.status === 504 || res.status >= 500) { await sleep(2000); continue; }
      const json = await res.json().catch(() => ({}));
      const els = Array.isArray(json.elements) ? json.elements : [];
      return els.map((e) => ({
        osm: `${e.type}/${e.id}`,
        kind: e.tags?.natural || e.tags?.place || 'other',
        lat: e.lat ?? e.center?.lat,
        lon: e.lon ?? e.center?.lon,
        names: [e.tags?.name, e.tags?.['name:el'], e.tags?.['name:en'], e.tags?.['alt_name'], e.tags?.['int_name']].filter(Boolean),
      })).filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
    } catch { /* next mirror */ }
  }
  return null;
};

// ── the beaches to resolve ───────────────────────────────────────────────────
const ids = new Set(String(arg('--ids', '')).split(',').map((s) => Number(s.trim())).filter(Boolean));
if (!ids.size) {
  console.error('Nothing to do: pass --ids 2652,2656');
  process.exit(1);
}
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = JSON.parse(readFileSync(sourcePath, 'utf8').replace(/^﻿/, ''));
const targets = [];
(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  if (ids.has(Number(node.id)) && typeof node.lat === 'number') {
    targets.push({
      id: Number(node.id),
      name: node.name,
      aliases: Array.isArray(node.metadata?.aliases) ? node.metadata.aliases : [],
      lat: node.lat,
      lon: node.lon,
    });
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(data);

const results = [];
for (const b of targets) {
  const places = await fetchNamedPlaces(b.lat, b.lon, RADIUS);
  if (places === null) {
    results.push({ id: b.id, name: b.name, verdict: 'FLAG', reason: 'Overpass unreachable' });
    continue;
  }
  const ourNames = [b.name, ...b.aliases];
  const hits = places
    .filter((p) => p.names.some((n) => ourNames.some((o) => nameMatches(o, n))))
    .map((p) => ({ ...p, distM: Math.round(distM(b.lat, b.lon, p.lat, p.lon)) }))
    .sort((a, z) => a.distM - z.distM);

  const beachHits = hits.filter((h) => h.kind === 'beach');
  const best = beachHits[0] || hits[0];

  if (!best) {
    results.push({
      id: b.id, name: b.name, verdict: 'KEEP',
      reason: `no OSM feature named «${b.name}» within ${RADIUS / 1000} km — OSM has not mapped this beach; the pin is the only record we have`,
      candidates: [],
    });
  } else if (best.distM <= SAME_PLACE_M) {
    results.push({
      id: b.id, name: b.name, verdict: 'KEEP',
      reason: `OSM «${best.names[0]}» (${best.osm}) is ${best.distM} m from our pin — same beach, unmapped polygon`,
      candidates: hits.slice(0, 4),
    });
  } else {
    results.push({
      id: b.id,
      name: b.name,
      verdict: best.kind === 'beach' ? 'MOVE' : 'FLAG',
      target: [Number(best.lat.toFixed(6)), Number(best.lon.toFixed(6))],
      polygonDistM: best.distM,
      confidence: `OSM ${best.kind} ${best.osm} named «${best.names[0]}»`,
      evidence: `name match ${best.distM} m away; our pin had no beach mapped within 1,2 km`,
      candidates: hits.slice(0, 4),
    });
  }
  await sleep(1500);
}

const out = { generatedAt: new Date().toISOString(), radiusM: RADIUS, samePlaceM: SAME_PLACE_M, results };
const outPath = path.isAbsolute(OUT) ? OUT : path.join(rootDir, OUT);
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

// ── the verdict has to outlive this report ───────────────────────────────────
// The placement audit re-derives its `confirmed` bucket from OSM every run, so it
// will keep listing an unmapped beach forever no matter how many times we clear
// it. The weekly board reads that bucket. Without a durable adjudication file the
// same six beaches accuse us every Monday and the real one hides among them.
const adjPath = path.join(rootDir, 'reports', 'quality', 'pin-adjudication.json');
const adjudication = existsSync(adjPath)
  ? JSON.parse(readFileSync(adjPath, 'utf8'))
  : { note: 'Rows the pin audits flag that a name search has since resolved. Consumed by scripts/buildQualityLedger.mjs.', cleared: [] };
const byId = new Map((adjudication.cleared || []).map((r) => [Number(r.id), r]));
const today = new Date().toISOString().slice(0, 10);
for (const r of results) {
  // A FLAG stays open on purpose: Overpass being down is not evidence of anything.
  if (r.verdict === 'KEEP') {
    byId.set(r.id, { id: r.id, name: r.name, at: today, verdict: 'KEEP', reason: r.reason });
  } else if (r.verdict === 'MOVE') {
    // A MOVE clears the row only once it has actually been applied — proposing a
    // target is not the same as having moved the pin, and a board that believes
    // the proposal would go quiet about a beach still pointing at the wrong bay.
    const beach = targets.find((t) => t.id === r.id);
    const moved = beach && Math.abs(beach.lat - r.target[0]) < 1e-5 && Math.abs(beach.lon - r.target[1]) < 1e-5;
    if (moved) byId.set(r.id, { id: r.id, name: r.name, at: today, verdict: 'MOVED', reason: `pin now at ${r.target.join(',')} — ${r.confidence}` });
  }
}
adjudication.cleared = [...byId.values()].sort((a, b) => a.id - b.id);
adjudication.generatedAt = new Date().toISOString();
writeFileSync(adjPath, JSON.stringify(adjudication, null, 2) + '\n', 'utf8');
for (const r of results) {
  console.log(`${r.verdict.padEnd(5)} ${String(r.id).padEnd(5)} ${r.name} — ${r.reason || r.evidence}${r.target ? ` → ${r.target.join(',')}` : ''}`);
}
console.log(`\n${results.length} rows → ${path.relative(rootDir, outPath)}`);
