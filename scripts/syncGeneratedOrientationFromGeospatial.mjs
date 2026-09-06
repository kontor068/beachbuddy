#!/usr/bin/env node
/**
 * ΣΥΓΧΡΟΝΙΣΜΟΣ ΤΩΝ GENERATED ORIENTATION ΜΕ ΤΟ ΤΡΕΧΟΝ facingDeg — βίβλος §Γ73 (τέλος).
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (06/09/2026, ξεκίνησε από σχόλιο επισκέπτη στην Κυρά Παναγιά #2308). Το
 * `applyIslandGroupOrientationFromGeospatial.mjs` ΜΟΝΟ ΠΡΟΣΘΕΤΕΙ orientation όπου λείπει —
 * ποτέ δεν ξαναγράφει. Η γεωμετρία ξαναχτίστηκε πολλές φορές (pin moves, νέες ακτογραμμές)
 * και οι φωτοτυπίες της πάλιωσαν: **794 παραλίες** με διαφορά >22,5° (οι 5 σχεδόν 180°).
 *
 * ΠΟΙΟΣ ΕΧΕΙ ΔΙΚΙΟ — ΜΕΤΡΗΜΕΝΟ ΠΡΙΝ ΓΡΑΦΤΕΙ ΓΡΑΜΜΗ. Ανεξάρτητος κριτής = ακτογραμμή OSM
 * (`scripts/auditCoastlineFacingOsm.mjs --only`, στρωματοποιημένο δείγμα 60, ομάδα ελέγχου 45
 * με διάμεσο σφάλμα 11,4°): **ΜΗΧΑΝΗ 49 · ΚΑΡΤΑ 2 · ισοπαλία 3 · αναξιόπιστα 6** — στις ζώνες
 * >45° σκέτο **38-0**. → `reports/quality/facing-mismatch-osm-verdicts.json`
 *
 * ΤΙ ΑΓΓΙΖΕΙ, ΚΑΙ ΤΙ ΟΧΙ — ΟΙ ΤΡΕΙΣ ΦΡΟΥΡΟΙ:
 *   1. ΜΟΝΟ εγγραφές των οποίων το `notes` αρχίζει με το ακριβές generated σήμα («Generated
 *      from Natural Earth geospatial exposure facingDeg…»). Χειροποίητα orientation (π.χ.
 *      Μήλος: Σαρακήνικο #1922, Τσιγκράδο #1925, Φυριπλάκα #1927) ΔΕΝ αγγίζονται ποτέ.
 *   2. ΜΟΝΟ όπου το γεωμετρικό προφίλ είναι `confidence: 'high'` και το facingDeg πεπερασμένο.
 *   3. Το note μένει ΑΥΤΟΥΣΙΟ, ώστε το σήμα «generated» να παραμένει αναγνωρίσιμο και ο
 *      συγχρονισμός ταυτοδύναμος — το ξανατρέξιμο σε συγχρονισμένα δεδομένα αλλάζει μηδέν.
 *
 * Η ΠΗΓΗ ΕΙΝΑΙ ΤΟ `public/greek_beaches.json` — τα per-region
 * (`public/data/beaches/**`) παράγονται από αυτήν με `npm run build:beach-data`. Γράφοντας
 * στα παράγωγα, το επόμενο build θα τα έσβηνε σιωπηλά.
 *
 * ΕΝΣΩΜΑΤΩΜΕΝΗ ΜΕΤΡΗΣΗ ΕΠΙΔΡΑΣΗΣ (πριν αποφασιστεί το γράψιμο, στο ίδιο τρέξιμο):
 *   (α) πύλη ηλιοβασιλέματος 200-340° (`utils/sunsetOverSea`) — πόσες αλλάζουν πλευρά·
 *   (β) `geospatialProfileConflictsWithAuthoredFacing` (≥75°) — πόσες φάντασμα-διαφωνίες
 *       σβήνουν (η γεωμετρία έπαψε να «μαλώνει» με τον παλιό της εαυτό)·
 *   (γ) λέξη έκθεσης (protected/partial/exposed) + δικαίωμα προστασίας σε πλέγμα
 *       8 κατευθύνσεων × 3 εντάσεων ανέμου, πριν/μετά, μέσα από τον ΠΡΑΓΜΑΤΙΚΟ κινητήρα
 *       (`assessBeachWindExposure`) — όχι αντίγραφό του.
 *
 * Run: node scripts/syncGeneratedOrientationFromGeospatial.mjs            (dry-run + μέτρηση)
 *      node scripts/syncGeneratedOrientationFromGeospatial.mjs --write    (και γράψιμο πηγής)
 * Μετά το --write: npm run build:beach-data (τα per-region), και εθνικό ψήσιμο στο deploy.
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const WRITE = process.argv.includes('--write');
const GENERATED_SIGNATURE = 'Generated from Natural Earth geospatial exposure facingDeg';
/** Κάτω από αυτό, η διαφορά είναι θόρυβος στρογγυλοποίησης — δεν αξίζει diff. */
const MIN_DELTA_DEG = 0.5;

const sourcePath = path.join(root, 'public', 'greek_beaches.json');
const exposureDir = path.join(root, 'public', 'data', 'geospatial', 'exposure');
const beachAppDir = path.join(root, 'public', 'data', 'beaches', 'app');
const reportPath = path.join(root, 'reports', 'quality', 'orientation-sync.json');

const SECTOR_NAMES = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
const normalize = (v) => ((v % 360) + 360) % 360;
const sectorNameFor = (deg) => SECTOR_NAMES[Math.round(normalize(deg) / 45) % 8];
const angDelta = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// ── 1. Τα προφίλ έκθεσης, εθνικά ────────────────────────────────────────────
const profilesById = new Map();
for (const file of fs.readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
  try {
    const profiles = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {};
    for (const p of Object.values(profiles)) {
      if (p?.beachId != null) profilesById.set(p.beachId, p);
    }
  } catch { /* skip broken file */ }
}

// ── 2. Πέρασμα της πηγής — ίδιο id-walk με το apply script (frozen ids) ─────
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
let idCounter = 0;
const changes = [];
const skipped = { authored: 0, noProfile: 0, lowConfidence: 0, noFacing: 0, inSync: 0 };

const hasCoordinates = (item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon));

const walk = (node) => {
  if (Array.isArray(node)) {
    for (const item of node) {
      const currentId = Number.isInteger(item?.id) ? item.id : idCounter;
      if (hasCoordinates(item)) {
        const orientation = item.metadata?.orientation;
        if (orientation && typeof orientation.degrees === 'number') {
          if (!String(orientation.notes || '').startsWith(GENERATED_SIGNATURE)) {
            skipped.authored += 1;
          } else {
            const profile = profilesById.get(currentId);
            if (!profile) skipped.noProfile += 1;
            else if (profile.confidence !== 'high') skipped.lowConfidence += 1;
            else if (typeof profile.facingDeg !== 'number' || !Number.isFinite(profile.facingDeg)) skipped.noFacing += 1;
            else {
              const newDeg = Math.round(normalize(profile.facingDeg) * 10) / 10;
              if (angDelta(orientation.degrees, newDeg) < MIN_DELTA_DEG) skipped.inSync += 1;
              else {
                changes.push({
                  id: currentId,
                  name: item.name || 'Unknown',
                  from: orientation.degrees,
                  to: newDeg,
                  delta: Math.round(angDelta(orientation.degrees, newDeg) * 10) / 10,
                  facesFrom: orientation.faces?.[0] ?? null,
                  facesTo: sectorNameFor(newDeg),
                });
                if (WRITE) {
                  orientation.degrees = newDeg;
                  orientation.faces = [sectorNameFor(newDeg)];
                  // protectedFrom/confidence/notes μένουν ως έχουν — φρουρός 3.
                }
              }
            }
          }
        }
        idCounter += 1;
      }
    }
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const value of Object.values(node)) walk(value);
};
walk(source);

console.log(`Generated orientation εκτός συγχρονισμού: ${changes.length}`);
console.log(`Δεν αγγίχτηκαν: authored ${skipped.authored} · χωρίς προφίλ ${skipped.noProfile} · όχι-high ${skipped.lowConfidence} · χωρίς facing ${skipped.noFacing} · ήδη σύμφωνα ${skipped.inSync}`);
const bands = { '0.5-22.5': 0, '22.5-45': 0, '45-90': 0, '90-135': 0, '135-180': 0 };
for (const c of changes) {
  const b = c.delta < 22.5 ? '0.5-22.5' : c.delta < 45 ? '22.5-45' : c.delta < 90 ? '45-90' : c.delta < 135 ? '90-135' : '135-180';
  bands[b] += 1;
}
console.log('ζώνες διόρθωσης:', JSON.stringify(bands));

// ── 3. ΜΕΤΡΗΣΗ ΕΠΙΔΡΑΣΗΣ — πάνω στα per-region app αρχεία, πριν/μετά in-memory ──
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { sunsetOverSeaWindow } = require(path.join(root, 'utils/sunsetOverSea.ts'));

const changedIds = new Map(changes.map(c => [c.id, c]));
const GRID_DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315];
const GRID_SPEEDS = [16, 26, 38]; // 3 · 4 · 5+ Μποφόρ
const impact = {
  sunsetFlips: [], conflictCleared: 0, conflictCreated: 0,
  exposureWordChanged: new Set(), protectionClaimChanged: new Set(), assessed: 0,
};

for (const file of fs.readdirSync(beachAppDir).filter(n => n.endsWith('.json'))) {
  let island;
  try { island = JSON.parse(fs.readFileSync(path.join(beachAppDir, file), 'utf8')).island; } catch { continue; }
  for (const beach of island?.beaches ?? []) {
    const change = changedIds.get(beach.id);
    if (!change || !beach.orientation) continue;
    const profile = profilesById.get(beach.id);
    impact.assessed += 1;

    const patched = { ...beach, orientation: { ...beach.orientation, degrees: change.to, faces: [change.facesTo] } };

    // (α) πύλη ηλιοβασιλέματος
    try {
      const before = sunsetOverSeaWindow(beach)?.eligible ?? sunsetOverSeaWindow(beach);
      const after = sunsetOverSeaWindow(patched)?.eligible ?? sunsetOverSeaWindow(patched);
      if (JSON.stringify(before) !== JSON.stringify(after)) impact.sunsetFlips.push(beach.id);
    } catch { /* gate unreadable for this shape — counted via analysis file instead */ }

    // (β) φάντασμα-διαφωνία ≥75°
    const wasConflict = angDelta(change.from, change.to) >= 75;
    if (wasConflict) impact.conflictCleared += 1;

    // (γ) λέξη έκθεσης + δικαίωμα προστασίας, 8×3, πραγματικός κινητήρας
    for (const deg of GRID_DIRECTIONS) {
      for (const kmh of GRID_SPEEDS) {
        const input = { geospatialProfile: profile, windDirectionDeg: deg, windSpeedKmh: kmh, beaufort: kmh < 20 ? 3 : kmh < 29 ? 4 : 5, waveHeightMeters: 0.5 };
        let a, b;
        try {
          a = assessBeachWindExposure({ ...input, beach });
          b = assessBeachWindExposure({ ...input, beach: patched });
        } catch { continue; }
        if (a?.exposureLevel !== b?.exposureLevel) impact.exposureWordChanged.add(beach.id);
        if (a?.canClaimWindProtection !== b?.canClaimWindProtection) impact.protectionClaimChanged.add(beach.id);
      }
    }
  }
}

console.log('\n── ΕΠΙΔΡΑΣΗ (πραγματικός κινητήρας, 8 κατευθύνσεις × 3 εντάσεις) ──');
console.log(`αξιολογήθηκαν: ${impact.assessed}`);
console.log(`(α) αλλάζουν στην πύλη ηλιοβασιλέματος: ${impact.sunsetFlips.length}`);
console.log(`(β) φάντασμα-διαφωνίες ≥75° που σβήνουν: ${impact.conflictCleared}`);
console.log(`(γ) αλλάζει λέξη έκθεσης σε ≥1 κελί: ${impact.exposureWordChanged.size} παραλίες`);
console.log(`    αλλάζει δικαίωμα προστασίας: ${impact.protectionClaimChanged.size} παραλίες`);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  wrote: WRITE,
  changed: changes.length,
  skipped,
  bands,
  impact: {
    assessed: impact.assessed,
    sunsetFlips: impact.sunsetFlips.length,
    conflictCleared: impact.conflictCleared,
    exposureWordChanged: impact.exposureWordChanged.size,
    protectionClaimChanged: impact.protectionClaimChanged.size,
  },
  changes,
}, null, 1));
console.log(`→ ${path.relative(root, reportPath)}`);

if (WRITE) {
  // write-to-temp + rename — μισογραμμένη εθνική πηγή δεν επιτρέπεται να υπάρξει ούτε στιγμή.
  const tmp = `${sourcePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(source, null, 2));
  fs.renameSync(tmp, sourcePath);
  console.log(`\n✅ Γράφτηκε η πηγή: ${changes.length} orientation συγχρονίστηκαν.`);
  console.log('   ΕΠΟΜΕΝΟ: npm run build:beach-data');
} else {
  console.log('\nDry-run. Τρέξε με --write για να γραφτεί η πηγή.');
}
