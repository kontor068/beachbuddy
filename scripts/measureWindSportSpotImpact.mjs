#!/usr/bin/env node
/**
 * ΤΙ ΚΟΣΤΙΖΕΙ ΜΙΑ ΣΗΜΑΙΑ «ΣΗΜΕΙΟ WINDSURF»;
 *
 * Ο κανόνας `knownWindSportSpot` είναι ΜΟΝΟΔΡΟΜΟΣ ΠΡΟΣ ΤΟ ΧΕΙΡΟΤΕΡΟ: στα ≥4 Μποφόρ κόβει
 * κάθε αξίωση προστασίας και σπρώχνει την κάρτα προς «Εκτεθειμένη»
 * (`utils/windExposureEngine.ts:934`). Άρα ΚΑΜΙΑ νέα εγγραφή δεν γράφεται πριν μετρηθεί τι
 * αλλάζει στην οθόνη.
 *
 * ΤΙ ΚΑΝΕΙ. Τρέχει τις ΔΥΟ μηχανές (κάρτα + πινέζα) πάνω στα αποθηκευμένα προφίλ με
 * συνθετικό άνεμο 8 τομείς × 4 εντάσεις, ΔΥΟ ΦΟΡΕΣ ανά παραλία: με τη σημαία ΚΛΕΙΣΤΗ και με
 * τη σημαία ΑΝΟΙΧΤΗ. Η διαφορά είναι ακριβώς η τιμή της εγγραφής.
 *
 * ΚΑΜΙΑ ΚΛΗΣΗ ΔΙΚΤΥΟΥ — ίδιο μοτίβο με `scripts/validateCardVsPinExposure.mjs`.
 *
 *   node scripts/measureWindSportSpotImpact.mjs
 *   node scripts/measureWindSportSpotImpact.mjs --candidates=<file.json> [--verbose]
 *   node scripts/measureWindSportSpotImpact.mjs --json=<out.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { WindDirection } = require(path.join(root, 'types.ts'));
const overridesModule = require(path.join(root, 'utils/windProfileOverrides.ts'));
const { getVisibleMapExposureLevel, getConsistentVisibleMapExposureLevels } = require(path.join(root, 'utils/mapExposure.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));

const argOf = (name) => (process.argv.find(a => a.startsWith('--' + name + '=')) || '').split('=').slice(1).join('=');
const candidatesArg = argOf('candidates');
const jsonOut = argOf('json');
const verbose = process.argv.includes('--verbose');

const SCEN = [
  { sector: 'N', dir: WindDirection.N, deg: 0 }, { sector: 'NE', dir: WindDirection.NE, deg: 45 },
  { sector: 'E', dir: WindDirection.E, deg: 90 }, { sector: 'SE', dir: WindDirection.SE, deg: 135 },
  { sector: 'S', dir: WindDirection.S, deg: 180 }, { sector: 'SW', dir: WindDirection.SW, deg: 225 },
  { sector: 'W', dir: WindDirection.W, deg: 270 }, { sector: 'NW', dir: WindDirection.NW, deg: 315 },
];
const BFS = [{ bft: 3, kmh: 15 }, { bft: 4, kmh: 25 }, { bft: 5, kmh: 35 }, { bft: 6, kmh: 45 }];
const NEUTRAL_SEA_M = 0.4;
const RANK = { protected: 0, partial: 1, exposed: 2 };

const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');

// ── Φόρτωση όλης της χώρας ────────────────────────────────────────────────────
const regions = [];
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const beaches = payload.island?.beaches || [];
  if (!beaches.length) continue;
  const profiles = {};
  try {
    const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8'));
    for (const pr of Object.values(p.profiles || {})) profiles[pr.beachId] = { ...pr, source: 'natural-earth-baseline' };
  } catch { /* περιοχή χωρίς γεωμετρία — η μηχανή πέφτει στο authored προφίλ, σωστά */ }
  regions.push({ regionId: rf.replace(/\.json$/, ''), beaches, profiles });
}

// ── Ποιες παραλίες κουβαλάνε ΗΔΗ τη σημαία ───────────────────────────────────
const baseOverride = overridesModule.getWindProfileOverride;
const flaggedNow = [];
const flaggedByList = [];
for (const r of regions) {
  for (const b of r.beaches) {
    const p = baseOverride(b);
    if (p && p.knownWindSportSpot) flaggedNow.push({ id: b.id, name: b.name?.gr || b.name?.en, region: r.regionId, via: 'προφίλ' });
    else if (overridesModule.KNOWN_WIND_SPORT_SPOT_IDS.has(b.id)) flaggedByList.push({ id: b.id, name: b.name?.gr || b.name?.en, region: r.regionId, via: 'κατάλογος' });
  }
}

// ── Το πείραμα: σημαία ΚΛΕΙΣΤΗ vs ΑΝΟΙΧΤΗ σε συγκεκριμένα ids ────────────────
//
// Δύο ΔΙΑΦΟΡΕΤΙΚΟΙ μηχανισμοί, γι' αυτό και δύο διαφορετικές λαβές:
//   · χειρόγραφο προφίλ (`windProfileOverridesByBeachId` / `overrideEntries`) — σβήνουμε τη
//     σημαία μέσα από το ίδιο το προφίλ.
//   · κατάλογος σημείων (`KNOWN_WIND_SPORT_SPOT_IDS`) — προσθαφαιρούμε id στο σύνολο, που
//     είναι το ΙΔΙΟ αντικείμενο που κρατάει η μηχανή, άρα η αλλαγή φαίνεται αμέσως.
// Έτσι η μέτρηση δείχνει ό,τι ακριβώς θα δει ο επισκέπτης, όχι μια προσέγγισή του.
let forcedOff = new Set();
overridesModule.getWindProfileOverride = (beach) => {
  const p = baseOverride(beach);
  if (forcedOff.has(beach.id)) return p ? { ...p, knownWindSportSpot: false } : p;
  return p;
};
const SPOT_IDS = overridesModule.KNOWN_WIND_SPORT_SPOT_IDS;
const spotIdsBaseline = new Set(SPOT_IDS);
const setSpotIds = (ids) => { SPOT_IDS.clear(); for (const id of ids) SPOT_IDS.add(id); };

/** Τρέχει όλη τη χώρα και γυρίζει Map<`id@sector@bft`, {card, pin, tone, onshore}>. */
const runNational = (targetIds) => {
  const out = new Map();
  for (const r of regions) {
    for (const { bft, kmh } of BFS) {
      for (const scen of SCEN) {
        const items = [];
        for (const beach of r.beaches) {
          let a;
          try {
            a = assessBeachWindExposure({
              beach, geospatialProfile: r.profiles[beach.id],
              windDirectionDeg: scen.deg, windDirection: scen.dir,
              windSpeedKmh: kmh, beaufort: bft, waveHeightMeters: 0.5,
            });
          } catch { continue; }
          items.push({
            beach, exposureLevel: a.exposureLevel, orientation: a.facingDeg,
            windProfile: a.windProfile, windProfileSource: a.source,
            windSector: a.windSector, warnings: a.warnings,
            geospatialExposure: r.profiles[beach.id],
          });
        }
        if (!items.length) continue;
        const consistent = getConsistentVisibleMapExposureLevels(items, bft, scen.deg);
        for (const item of items) {
          if (!targetIds.has(item.beach.id)) continue;
          const card = item.exposureLevel;
          const pin = consistent.get(item.beach.id) || getVisibleMapExposureLevel(item, bft, scen.deg);
          if (!card || !pin) continue;
          out.set(item.beach.id + '@' + scen.sector + '@' + bft, {
            card, pin,
            tone: resolveConditionTone({ exposureLevel: card, beaufort: bft, seaStateM: NEUTRAL_SEA_M, isEnclosedCove: false, offshoreFlatWater: false }),
            onshore: r.profiles[item.beach.id]?.sectors?.[scen.sector]?.onshore ?? null,
          });
        }
      }
    }
  }
  return out;
};

const diff = (before, after) => {
  const rows = [];
  for (const [key, b] of before) {
    const a = after.get(key);
    if (!a) continue;
    if (a.card !== b.card || a.pin !== b.pin || a.tone !== b.tone) {
      const [id, sector, bft] = key.split('@');
      rows.push({
        id: Number(id), sector, bft: Number(bft), onshore: b.onshore,
        cardBefore: b.card, cardAfter: a.card, pinBefore: b.pin, pinAfter: a.pin,
        toneBefore: b.tone, toneAfter: a.tone,
      });
    }
  }
  return rows;
};

const nameOf = new Map();
for (const r of regions) for (const b of r.beaches) nameOf.set(b.id, { name: b.name?.gr || b.name?.en, region: r.regionId });

const report = { flaggedNow, flaggedByList, existing: null, candidates: null };

// ── Α. Τι κάνουν οι ΥΠΑΡΧΟΥΣΕΣ σημαίες ───────────────────────────────────────
const existingIds = new Set(flaggedNow.map(f => f.id));
console.log('=== ΥΠΑΡΧΟΥΣΕΣ ΣΗΜΑΙΕΣ ===');
console.log('Από χειρόγραφο προφίλ: ' + flaggedNow.length + ' · από τον κατάλογο σημείων: ' + flaggedByList.length);
for (const f of flaggedNow) console.log('  #' + f.id + ' ' + f.name + ' [' + f.region + ']');

const withFlag = runNational(existingIds);
forcedOff = new Set(existingIds);
const withoutFlag = runNational(existingIds);
forcedOff = new Set();

const existingRows = diff(withoutFlag, withFlag); // χωρίς -> με
report.existing = existingRows;
const cells = flaggedNow.length * SCEN.length * BFS.length;
const worseCard = existingRows.filter(r => RANK[r.cardAfter] > RANK[r.cardBefore]);
const worsePin = existingRows.filter(r => RANK[r.pinAfter] > RANK[r.pinBefore]);
const toneChanged = existingRows.filter(r => r.toneBefore !== r.toneAfter);
console.log('\nΤι αλλάζει η σημαία σήμερα (σε ' + cells.toLocaleString('el-GR') + ' τομεοεντάσεις):');
console.log('  κάρτα χειρότερη: ' + worseCard.length + '   πινέζα χειρότερη: ' + worsePin.length + '   ΟΡΑΤΟ (αλλάζει ο τόνος): ' + toneChanged.length);
const byBeach = new Map();
for (const r of toneChanged) byBeach.set(r.id, (byBeach.get(r.id) || 0) + 1);
for (const [id, n] of [...byBeach].sort((a, b) => b[1] - a[1])) {
  console.log('  #' + id + ' ' + nameOf.get(id)?.name + ': ' + n + ' ορατές αλλαγές');
}
if (verbose) for (const r of toneChanged) {
  console.log('    #' + r.id + ' @' + r.sector + ' ' + r.bft + 'Μπφ onshore=' + (r.onshore ?? '—') + ' · κάρτα ' + r.cardBefore + '→' + r.cardAfter + ' · τόνος ' + r.toneBefore + '→' + r.toneAfter);
}

// ── Β. Τι ΘΑ έκαναν οι υποψήφιες ─────────────────────────────────────────────
if (candidatesArg) {
  const cands = JSON.parse(fs.readFileSync(path.resolve(root, candidatesArg), 'utf8'));
  const candIds = new Set(cands.map(c => c.id).filter(id => !existingIds.has(id)));
  console.log('\n=== ΥΠΟΨΗΦΙΕΣ (' + candIds.size + ') ===');
  setSpotIds([...spotIdsBaseline].filter(id => !candIds.has(id)));
  const before = runNational(candIds);
  setSpotIds(new Set([...spotIdsBaseline, ...candIds]));
  const after = runNational(candIds);
  setSpotIds(spotIdsBaseline);
  const rows = diff(before, after);
  report.candidates = rows;
  const tone = rows.filter(r => r.toneBefore !== r.toneAfter);
  const perBeach = new Map();
  for (const r of rows) {
    const e = perBeach.get(r.id) || { any: 0, tone: 0 };
    e.any += 1; if (r.toneBefore !== r.toneAfter) e.tone += 1;
    perBeach.set(r.id, e);
  }
  console.log('Συνολικά: ' + rows.length + ' τομεοεντάσεις αλλάζουν, ' + tone.length + ' ΟΡΑΤΑ, σε ' + (candIds.size * SCEN.length * BFS.length) + ' κελιά\n');
  for (const c of cands) {
    const known = nameOf.get(c.id);
    if (!known) { console.log('  #' + c.id + ' ' + c.name + ' — ΔΕΝ ΒΡΕΘΗΚΕ στα δεδομένα'); continue; }
    if (!candIds.has(c.id)) { console.log('  #' + c.id + ' ' + known.name + ' — ΗΔΗ σημειωμένη'); continue; }
    const e = perBeach.get(c.id) || { any: 0, tone: 0 };
    console.log('  #' + c.id + ' ' + known.name + ' [' + known.region + '] → ' + e.tone + ' ορατές / ' + e.any + ' αλλαγές');
    if (verbose) for (const r of rows.filter(x => x.id === c.id && x.toneBefore !== x.toneAfter)) {
      console.log('      @' + r.sector + ' ' + r.bft + 'Μπφ onshore=' + (r.onshore ?? '—') + ' · κάρτα ' + r.cardBefore + '→' + r.cardAfter + ' · τόνος ' + r.toneBefore + '→' + r.toneAfter);
    }
  }
}

if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(root, jsonOut)), { recursive: true });
  fs.writeFileSync(path.resolve(root, jsonOut), JSON.stringify(report, null, 2));
  console.log('\nΑναφορά: ' + jsonOut);
}
