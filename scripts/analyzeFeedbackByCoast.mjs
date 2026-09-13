#!/usr/bin/env node
/**
 * ΣΧΟΛΙΑ ΑΝΑ ΤΜΗΜΑ ΑΚΤΗΣ — ΠΟΥ ΜΑΖΕΥΟΝΤΑΙ ΤΑ «ΕΙΧΕ ΚΥΜΑ / ΕΙΧΕ ΑΕΡΑ»; (13/09/2026, βίβλος §Γ81 Δ2-Β)
 *
 * Η Δ2 (12/09) διάβασε για πρώτη φορά τα 50 σχόλια: 31 «χειρότερα απ' ό,τι είπαμε», 20/28 σε «προστατευμένη», και ένα μοτίβο
 * που ο βαθμονομητής ανά παραλία δεν βλέπει: 5 «αέρας» σε 4 διαφορετικές παραλίες της νότιας Νάξου. Ο βαθμονομητής
 * (scripts/calibrateFromFeedback.mjs, κελί = παραλία × τομέας ανέμου) θέλει ≥3 σχόλια στην ΙΔΙΑ παραλία για να μιλήσει —
 * με 50 σχόλια σε 2.856 παραλίες δεν θα μιλήσει ποτέ. Εδώ το κελί είναι το ΤΜΗΜΑ ΑΚΤΗΣ: περιοχή × προς τα πού κοιτάζει η
 * παραλία (facingDeg του γεωχωρικού προφίλ, 8 τομείς των 45°). Τέσσερις παραλίες της ίδιας ακτής που λένε το ίδιο πράγμα
 * είναι ένα εύρημα για την ακτή (σημείο ανέμου περιοχής, K_d, έκθεση), όχι τέσσερις τυχαίες γκρίνιες.
 *
 * Διαβάζει την ακατέργαστη εξαγωγή (.tmp/feedback-export.json, από scripts/exportFeedbackFromBlobs.mjs — μένει εκτός git)
 * και γράφει μόνο αθροίσματα: reports/feedback/coast-segments-<ημερομηνία>.json. Καμία αλλαγή στη σελίδα.
 *
 *   node scripts/analyzeFeedbackByCoast.mjs [--input .tmp/feedback-export.json] [--minNegative=3] [--minBeaches=2]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, dflt) => { const hit = args.find(a => a.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : dflt; };
const inputPath = path.resolve(arg('input', '.tmp/feedback-export.json'));
const MIN_NEGATIVE = Number(arg('minNegative', 3));
const MIN_BEACHES = Number(arg('minBeaches', 2));

const SECTORS = ['Β', 'ΒΑ', 'Α', 'ΝΑ', 'Ν', 'ΝΔ', 'Δ', 'ΒΔ'];
const sectorOf = (deg) => (Number.isFinite(deg) ? SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] : '?');
const NEGATIVE = new Set(['had_waves', 'too_windy']);

// beachId → { name, region, facingDeg, exposure }
const beachInfo = new Map();
const appDir = path.join(root, 'public/data/beaches/app');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
for (const f of readdirSync(appDir).filter(n => n.endsWith('.json'))) {
  const regionId = f.replace(/\.json$/, '');
  const app = JSON.parse(readFileSync(path.join(appDir, f), 'utf8'));
  let profiles = {};
  try { for (const p of Object.values(JSON.parse(readFileSync(path.join(exposureDir, f), 'utf8')).profiles ?? {})) if (p?.beachId != null) profiles[p.beachId] = p; } catch { /* περιοχή χωρίς προφίλ */ }
  for (const b of app.island?.beaches ?? []) {
    if (typeof b.id !== 'number') continue;
    beachInfo.set(b.id, { name: b.name?.en ?? String(b.id), region: regionId, facingDeg: profiles[b.id]?.facingDeg ?? null, exposure: b.windExposure?.level ?? b.exposure ?? null });
  }
}

let records = [];
try { records = JSON.parse(readFileSync(inputPath, 'utf8')); } catch { console.error(`Δεν βρέθηκε η εξαγωγή σχολίων: ${inputPath} — τρέξε πρώτα node scripts/exportFeedbackFromBlobs.mjs`); process.exit(1); }
if (!Array.isArray(records)) records = [];

const segments = new Map();
let placed = 0, unknownBeach = 0, noFacing = 0;
for (const fb of records) {
  if (typeof fb?.beachId !== 'number' || typeof fb?.feedback !== 'string') continue;
  const info = beachInfo.get(fb.beachId);
  if (!info) { unknownBeach += 1; continue; }
  if (!Number.isFinite(info.facingDeg)) noFacing += 1;
  const sector = sectorOf(info.facingDeg);
  const key = `${info.region} · ${sector}`;
  const seg = segments.get(key) ?? { region: info.region, sector, records: 0, negative: 0, calmer: 0, accurate: 0, byVerdict: {}, beaches: new Map(), months: {}, exposureShown: {}, beaufortShown: {} };
  seg.records += 1;
  seg.byVerdict[fb.feedback] = (seg.byVerdict[fb.feedback] || 0) + 1;
  if (NEGATIVE.has(fb.feedback)) seg.negative += 1; else if (fb.feedback === 'calmer') seg.calmer += 1; else if (fb.feedback === 'accurate') seg.accurate += 1;
  const b = seg.beaches.get(fb.beachId) ?? { beachId: fb.beachId, name: info.name, facingDeg: info.facingDeg, verdicts: [] };
  b.verdicts.push(fb.feedback); seg.beaches.set(fb.beachId, b);
  const month = String(fb.conditions?.date ?? fb.timestamp ?? '').slice(0, 7); if (month) seg.months[month] = (seg.months[month] || 0) + 1;
  const ex = fb.conditions?.exposureLevel ?? '?'; seg.exposureShown[ex] = (seg.exposureShown[ex] || 0) + 1;
  const bft = fb.conditions?.beaufort ?? '?'; seg.beaufortShown[bft] = (seg.beaufortShown[bft] || 0) + 1;
  segments.set(key, seg); placed += 1;
}

const rows = [...segments.values()].map(s => ({
  ...s, beachCount: s.beaches.size, negativeBeaches: [...s.beaches.values()].filter(b => b.verdicts.some(v => NEGATIVE.has(v))).length,
  beaches: [...s.beaches.values()].map(b => ({ ...b, facingDeg: Number.isFinite(b.facingDeg) ? Math.round(b.facingDeg) : null })),
})).sort((a, b) => b.negative - a.negative || b.records - a.records);
const systematic = rows.filter(r => r.negative >= MIN_NEGATIVE && r.negativeBeaches >= MIN_BEACHES);
const perBeachWouldSee = rows.flatMap(r => r.beaches).filter(b => b.verdicts.filter(v => NEGATIVE.has(v)).length >= MIN_NEGATIVE).length;

const report = {
  generatedAt: new Date().toISOString(), input: path.relative(root, inputPath), records: records.length, placed, unknownBeach, noFacing,
  cell: 'περιοχή × τομέας προσανατολισμού ακτής (facingDeg του γεωχωρικού προφίλ, 8 × 45°)',
  thresholds: { minNegative: MIN_NEGATIVE, minBeaches: MIN_BEACHES },
  headline: { segments: rows.length, systematicSegments: systematic.length, beachesTheperBeachCalibratorWouldFlag: perBeachWouldSee },
  systematic, segments: rows,
  note: 'Μόνο αθροίσματα σχολίων — ΟΧΙ βαθμονόμηση. Ένα «συστηματικό» τμήμα είναι ένδειξη για την ακτή (σημείο ανέμου περιοχής, K_d, έκθεση), που θέλει κριτή (κάμερα/METAR/replay) πριν αγγίξει αριθμό. Τα σχόλια DE/IT/FR δεν έχουν σημαία «επιτόπου» (βλ. 11/09).',
};
const out = path.join(root, 'reports/feedback', `coast-segments-${new Date().toISOString().slice(0, 10)}.json`);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`Σχόλια ${records.length} · τοποθετήθηκαν ${placed} σε ${rows.length} τμήματα ακτής (άγνωστη παραλία ${unknownBeach}, χωρίς προσανατολισμό ${noFacing})`);
console.log(`Συστηματικά τμήματα (≥${MIN_NEGATIVE} αρνητικά σε ≥${MIN_BEACHES} παραλίες): ${systematic.length} — ο βαθμονομητής ανά παραλία θα έβλεπε ${perBeachWouldSee} παραλίες`);
for (const s of rows.slice(0, 12)) console.log(`  ${s.region} · ${s.sector}: αρνητικά ${s.negative}/${s.records} σε ${s.negativeBeaches}/${s.beachCount} παραλίες ${JSON.stringify(s.byVerdict)} · έκθεση ${JSON.stringify(s.exposureShown)} · Μπφ ${JSON.stringify(s.beaufortShown)}${systematic.includes(s) ? '  ← ΣΥΣΤΗΜΑΤΙΚΟ' : ''}`);
console.log(`→ ${path.relative(root, out)}`);
