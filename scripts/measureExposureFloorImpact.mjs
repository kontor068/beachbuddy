#!/usr/bin/env node
// measureExposureFloorImpact.mjs
//
// ΕΘΝΙΚΗ ΜΕΤΡΗΣΗ — offline, πάνω στα ίδια τα geospatial exposure profiles.
// Δεν αλλάζει ΚΑΝΕΝΑ αρχείο. Μόνο μετράει τι θα άλλαζε αν πείραζε κανείς
// το «δάπεδο 0,6» του τύπου έντασης (utils/geospatialExposureModel.ts:273-311).
//
// Baseline (όπως τρέχει σήμερα):
//   onshoreFactor = (clamp(onshore,-1,1) + 1) / 2
//   fetchFactor   = clamp(fetchKm / 12, 0, 1)
//   saturation    = clamp((fetchKm - 8) / 4, 0, 1)
//   openness      = saturation + (1 - saturation) * (1 - clamp(blockedRayRatio,0,1))
//   intensity     = 100 * onshoreFactor * (0.6 + 0.4 * fetchFactor * openness)
//   level         = intensity >= 60 ? 'exposed' : intensity >= 33 ? 'partial' : 'protected'
//
// Υποψήφιες διορθώσεις:
//   Α) hard zero        : fetchKm === 0  ->  intensity = 0
//   Β) ramp             : 0.6 * min(1, fetchKm/2)  αντί για σταθερό 0.6
//   Γ) openness-gated   : 0.6 * openness            αντί για σταθερό 0.6
//
// Χρήση: node scripts/measureExposureFloorImpact.mjs

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPOSURE_DIR = path.join(__dirname, '..', 'public', 'data', 'geospatial', 'exposure');

const FETCH_SATURATION_KM = 12;
const OPENNESS_RAMP_START_KM = 8;
const EXPOSED_INTENSITY = 60;
const PROTECTED_INTENSITY = 33;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const levelOf = (intensity) =>
  intensity >= EXPOSED_INTENSITY ? 'exposed' : intensity >= PROTECTED_INTENSITY ? 'partial' : 'protected';

const LEVEL_RANK = { protected: 0, partial: 1, exposed: 2 };

const parts = ({ fetchKm, blockedRayRatio, onshore }) => {
  const onshoreFactor = (clamp(onshore, -1, 1) + 1) / 2;
  const fetchFactor = clamp(fetchKm / FETCH_SATURATION_KM, 0, 1);
  const saturation = clamp((fetchKm - OPENNESS_RAMP_START_KM) / (FETCH_SATURATION_KM - OPENNESS_RAMP_START_KM), 0, 1);
  const openness = saturation + (1 - saturation) * (1 - clamp(blockedRayRatio, 0, 1));
  return { onshoreFactor, fetchFactor, openness };
};

const round1 = (n) => Number(n.toFixed(1));

const VARIANTS = {
  BASE: (s) => {
    const { onshoreFactor, fetchFactor, openness } = parts(s);
    return round1(100 * onshoreFactor * (0.6 + 0.4 * fetchFactor * openness));
  },
  // Α) hard zero
  A: (s) => {
    if (s.fetchKm === 0) return 0;
    const { onshoreFactor, fetchFactor, openness } = parts(s);
    return round1(100 * onshoreFactor * (0.6 + 0.4 * fetchFactor * openness));
  },
  // Β) ramp — το δάπεδο σβήνει γραμμικά κάτω από 2 χλμ fetch
  B: (s) => {
    const { onshoreFactor, fetchFactor, openness } = parts(s);
    const floor = 0.6 * Math.min(1, s.fetchKm / 2);
    return round1(100 * onshoreFactor * (floor + 0.4 * fetchFactor * openness));
  },
  // Γ) openness-gated floor — το δάπεδο πολλαπλασιάζεται με το άνοιγμα
  C: (s) => {
    const { onshoreFactor, fetchFactor, openness } = parts(s);
    return round1(100 * onshoreFactor * (0.6 * openness + 0.4 * fetchFactor * openness));
  },
};

const VARIANT_LABEL = {
  A: 'Α) hard zero — fetchKm === 0 => intensity = 0',
  B: 'Β) ramp — 0,6 × min(1, fetchKm/2) αντί για σταθερό 0,6',
  C: 'Γ) openness-gated floor — 0,6 × openness αντί για σταθερό 0,6',
};

const BUCKETS = [
  { key: '0 χλμ (ακριβώς)', test: (f) => f === 0 },
  { key: '0-1 χλμ', test: (f) => f > 0 && f < 1 },
  { key: '1-2 χλμ', test: (f) => f >= 1 && f < 2 },
  { key: '2-5 χλμ', test: (f) => f >= 2 && f < 5 },
  { key: '5-8 χλμ', test: (f) => f >= 5 && f < 8 },
  { key: '8+ χλμ', test: (f) => f >= 8 },
];

const bucketOf = (f) => (BUCKETS.find((b) => b.test(f)) || { key: '???' }).key;

// ---------------------------------------------------------------- load
const files = readdirSync(EXPOSURE_DIR).filter((f) => f.endsWith('.json')).sort();
const rows = [];
const beachSet = new Set();
let profileCount = 0;
let storedMismatch = 0;
let incompleteSectors = 0;
const incompleteBeaches = new Set();
const storedMismatchSamples = [];

// Δεύτερος μάρτυρας: παραλίες που ΑΝΘΡΩΠΟΣ έχει ήδη χαρακτηρίσει κλειστό όρμο.
const curatedSrc = readFileSync(path.join(__dirname, '..', 'utils', 'enclosedCoves.ts'), 'utf8');
const curatedBlock = curatedSrc.split('CURATED_ENCLOSED_COVE_IDS')[1] || '';
const CURATED_COVE_IDS = new Set(
  (curatedBlock.split(']')[0].match(/^\s*(\d+),/gm) || []).map((m) => Number(m.trim().replace(',', '')))
);

for (const file of files) {
  const doc = JSON.parse(readFileSync(path.join(EXPOSURE_DIR, file), 'utf8'));
  const profiles = doc.profiles || {};
  for (const key of Object.keys(profiles)) {
    const p = profiles[key];
    if (!p || !p.sectors) continue;
    profileCount += 1;
    const beachKey = `${file}#${p.beachId}`;
    beachSet.add(beachKey);
    for (const sector of Object.keys(p.sectors)) {
      const s = p.sectors[sector];
      if (!s || typeof s.fetchKm !== 'number') continue;
      if (typeof s.onshore !== 'number' || typeof s.intensity !== 'number') {
        incompleteSectors += 1;
        incompleteBeaches.add(`${p.name?.gr || p.beachId} (id ${p.beachId}, ${file})`);
        continue;
      }
      const input = { fetchKm: s.fetchKm, blockedRayRatio: s.blockedRayRatio, onshore: s.onshore };
      const base = VARIANTS.BASE(input);
      if (Math.abs(base - s.intensity) > 0.15 || levelOf(base) !== s.level) {
        storedMismatch += 1;
        if (storedMismatchSamples.length < 5) {
          storedMismatchSamples.push(
            `${p.name?.gr || p.name?.en || p.beachId} @${sector}: stored ${s.intensity}/${s.level} vs recomputed ${base}/${levelOf(base)}`
          );
        }
      }
      rows.push({
        region: doc.region?.id || file.replace(/\.json$/, ''),
        file,
        beachKey,
        beachId: p.beachId,
        name: p.name?.gr || p.name?.en || String(p.beachId),
        confidence: p.confidence,
        sector,
        fetchKm: s.fetchKm,
        blockedRayRatio: s.blockedRayRatio,
        onshore: s.onshore,
        storedIntensity: s.intensity,
        storedLevel: s.level,
        baseIntensity: base,
        baseLevel: levelOf(base),
      });
    }
  }
}

// ---------------------------------------------------------------- output
const out = [];
const w = (line = '') => out.push(line);

w('='.repeat(78));
w('ΕΘΝΙΚΗ ΜΕΤΡΗΣΗ — ΤΟ ΔΑΠΕΔΟ 0,6 ΤΟΥ ΤΥΠΟΥ ΕΝΤΑΣΗΣ');
w('='.repeat(78));
w(`Αρχεία περιοχών      : ${files.length}`);
w(`Παραλίες (profiles)  : ${profileCount}`);
w(`Τομείς (παραλία×8)   : ${rows.length}`);
w(`Baseline vs stored   : ${storedMismatch} διαφορές (πρέπει να είναι 0)`);
storedMismatchSamples.forEach((s) => w(`   ! ${s}`));
w(`Ελλιπείς τομείς      : ${incompleteSectors} (χωρίς onshore/intensity — εξαιρέθηκαν)`);
[...incompleteBeaches].forEach((b) => w(`   ! ${b}`));
w(`Χειροκίνητοι όρμοι   : ${CURATED_COVE_IDS.size} ids (utils/enclosedCoves.ts)`);
w();

// σκληρός πυρήνας
const core = rows.filter((r) => r.fetchKm === 0 && r.blockedRayRatio >= 0.95);
const coreNotProtected = core.filter((r) => r.baseLevel !== 'protected');
const coreNotProtectedHigh = coreNotProtected.filter((r) => r.confidence === 'high');
w('ΣΚΛΗΡΟΣ ΠΥΡΗΝΑΣ (fetchKm = 0 ΚΑΙ blockedRayRatio >= 0,95)');
w(`  τομείς                          : ${core.length}`);
w(`  εκ των οποίων ΟΧΙ 'protected'   : ${coreNotProtected.length} (${((coreNotProtected.length / rows.length) * 100).toFixed(1)}% όλων των τομέων)`);
w(`     - σε παραλίες confidence high: ${coreNotProtectedHigh.length}`);
w(`  διακριτές παραλίες              : ${new Set(coreNotProtected.map((r) => r.beachKey)).size}`);
const coreByLevel = {};
for (const r of coreNotProtected) coreByLevel[r.baseLevel] = (coreByLevel[r.baseLevel] || 0) + 1;
w(`  ανά επίπεδο                     : ${Object.entries(coreByLevel).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
const coreCurated = coreNotProtected.filter((r) => CURATED_COVE_IDS.has(r.beachId));
w(`  ΔΕΥΤΕΡΟΣ ΜΑΡΤΥΡΑΣ — σε χειροκίνητα καταχωρημένο όρμο: ${coreCurated.length} τομείς / ${new Set(coreCurated.map((r) => r.beachKey)).size} παραλίες`);
coreCurated.forEach((r) => w(`     ${r.name} (id ${r.beachId}) @${r.sector}: onshore ${r.onshore}, ένταση ${r.baseIntensity} -> protected`));
w();

// ---------------------------------------------------------------- per variant
const summaries = {};

for (const key of ['A', 'B', 'C']) {
  const fn = VARIANTS[key];
  const changed = [];
  for (const r of rows) {
    const nextIntensity = fn(r);
    const nextLevel = levelOf(nextIntensity);
    if (nextLevel !== r.baseLevel) {
      changed.push({ ...r, nextIntensity, nextLevel, direction: LEVEL_RANK[nextLevel] < LEVEL_RANK[r.baseLevel] ? 'calmer' : 'rougher' });
    }
  }

  const calmer = changed.filter((c) => c.direction === 'calmer');
  const rougher = changed.filter((c) => c.direction === 'rougher');
  const dangerous = calmer.filter((c) => c.fetchKm >= 5);

  summaries[key] = { changed, calmer, rougher, dangerous };

  w('-'.repeat(78));
  w(`ΠΑΡΑΛΛΑΓΗ ${VARIANT_LABEL[key]}`);
  w('-'.repeat(78));
  w(`Τομείς που αλλάζουν επίπεδο : ${changed.length} / ${rows.length} (${((changed.length / rows.length) * 100).toFixed(2)}%)`);
  w(`   πιο ΗΡΕΜΟ                : ${calmer.length}`);
  w(`   πιο ΑΓΡΙΟ                : ${rougher.length}`);
  w(`Παραλίες που αγγίζονται     : ${new Set(changed.map((c) => c.beachKey)).size} (από ${beachSet.size})`);
  w(`   με confidence 'high'     : ${new Set(changed.filter((c) => c.confidence === 'high').map((c) => c.beachKey)).size}`);
  w(`Περιοχές που αγγίζονται     : ${new Set(changed.map((c) => c.region)).size} / ${files.length}`);

  // μεταβάσεις
  const transitions = {};
  for (const c of changed) {
    const t = `${c.baseLevel} -> ${c.nextLevel}`;
    transitions[t] = (transitions[t] || 0) + 1;
  }
  w('Μεταβάσεις:');
  Object.entries(transitions).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => w(`   ${t.padEnd(26)} ${n}`));

  // buckets
  w('Κατανομή αλλαγών ανά fetchKm:');
  w(`   ${'bucket'.padEnd(18)} ${'τομείς'.padStart(7)} ${'πιο ήρεμο'.padStart(11)} ${'πιο άγριο'.padStart(11)} ${'σύνολο τομέων'.padStart(14)}`);
  for (const b of BUCKETS) {
    const all = rows.filter((r) => b.test(r.fetchKm)).length;
    const ch = changed.filter((c) => b.test(c.fetchKm));
    const ca = ch.filter((c) => c.direction === 'calmer').length;
    const ro = ch.length - ca;
    w(`   ${b.key.padEnd(18)} ${String(ch.length).padStart(7)} ${String(ca).padStart(11)} ${String(ro).padStart(11)} ${String(all).padStart(14)}`);
  }

  // ΚΡΙΣΙΜΟ
  w(`ΚΡΙΣΙΜΟ — τομείς με fetchKm >= 5 χλμ που γίνονται ΠΙΟ ΗΡΕΜΟΙ: ${dangerous.length}${dangerous.length === 0 ? '  ✔ (μηδέν = η διόρθωση αγγίζει μόνο κλειστό νερό)' : '  ✘ ΠΡΟΣΟΧΗ'}`);

  // top 15 by fetch
  const top = [...calmer].sort((a, b) => b.fetchKm - a.fetchKm || b.baseIntensity - a.baseIntensity).slice(0, 15);
  w('Οι 15 με το μεγαλύτερο fetch που γίνονται πιο ήρεμες:');
  if (top.length === 0) {
    w('   (καμία)');
  } else {
    w(`   ${'#'.padStart(3)} ${'παραλία'.padEnd(26)} ${'τομ'.padEnd(4)} ${'fetch'.padStart(6)} ${'block'.padStart(6)} ${'onsh'.padStart(7)} ${'πριν'.padStart(6)} ${'μετά'.padStart(6)}  αλλαγή`);
    top.forEach((c, i) => {
      w(
        `   ${String(i + 1).padStart(3)} ${c.name.slice(0, 26).padEnd(26)} ${c.sector.padEnd(4)} ${c.fetchKm.toFixed(1).padStart(6)} ${String(c.blockedRayRatio).padStart(6)} ${String(c.onshore).padStart(7)} ${c.baseIntensity.toFixed(1).padStart(6)} ${c.nextIntensity.toFixed(1).padStart(6)}  ${c.baseLevel} -> ${c.nextLevel} [${c.region}]`
      );
    });
  }
  w();
}

// ---------------------------------------------------------------- Λιμνιώνας
w('-'.repeat(78));
w('Η ΑΦΟΡΜΗ — Λιμνιώνας Κυθήρων (id 133)');
w('-'.repeat(78));
const limn = rows.filter((r) => r.beachId === 133 && r.region.includes('kythira'));
if (limn.length === 0) {
  w('  (δεν βρέθηκε)');
} else {
  w(`   ${'τομ'.padEnd(4)} ${'fetch'.padStart(6)} ${'block'.padStart(6)} ${'onsh'.padStart(7)} ${'ΤΩΡΑ'.padStart(20)} ${'Α'.padStart(18)} ${'Β'.padStart(18)} ${'Γ'.padStart(18)}`);
  for (const r of limn) {
    const fmt = (v) => `${v.toFixed(1)} ${levelOf(v)}`;
    w(
      `   ${r.sector.padEnd(4)} ${r.fetchKm.toFixed(1).padStart(6)} ${String(r.blockedRayRatio).padStart(6)} ${String(r.onshore).padStart(7)} ${fmt(r.baseIntensity).padStart(20)} ${fmt(VARIANTS.A(r)).padStart(18)} ${fmt(VARIANTS.B(r)).padStart(18)} ${fmt(VARIANTS.C(r)).padStart(18)}`
    );
  }
}
w();

// ---------------------------------------------------------------- σύγκριση
w('='.repeat(78));
w('ΣΥΓΚΡΙΣΗ');
w('='.repeat(78));
w(`   ${'παραλλαγή'.padEnd(10)} ${'αλλαγές'.padStart(8)} ${'ηρεμότερα'.padStart(10)} ${'αγριότερα'.padStart(10)} ${'παραλίες'.padStart(9)} ${'fetch>=5 ηρεμότερα'.padStart(19)}`);
for (const key of ['A', 'B', 'C']) {
  const s = summaries[key];
  w(
    `   ${key.padEnd(10)} ${String(s.changed.length).padStart(8)} ${String(s.calmer.length).padStart(10)} ${String(s.rougher.length).padStart(10)} ${String(new Set(s.changed.map((c) => c.beachKey)).size).padStart(9)} ${String(s.dangerous.length).padStart(19)}`
  );
}
w();

process.stdout.write(out.join('\n') + '\n');
