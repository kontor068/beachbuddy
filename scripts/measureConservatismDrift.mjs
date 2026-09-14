#!/usr/bin/env node
/**
 * ΓΙΝΑΜΕ ΠΙΟ ΦΟΒΙΚΟΙ ΑΠ᾽ Ο,ΤΙ ΗΜΑΣΤΑΝ; — Η ΜΕΤΑΤΟΠΙΣΗ ΣΥΝΤΗΡΗΤΙΣΜΟΥ, ΜΕΤΡΗΜΕΝΗ (14/09/2026).
 *
 * ΤΟ ΚΕΝΟ. Το ταμπλό ειλικρίνειας (`scripts/buildHonestyScorecard.mjs:102-106`) έχει έξι αριθμούς.
 * Ο ένας, «Μετατόπιση συντηρητισμού από το κλείδωμα (05/08)», γράφει από τις 21/08 **«ΔΕΝ ΜΕΤΡΗΘΗΚΕ
 * ΠΟΤΕ»** με `value: null`. Είναι ο μόνος αριθμός που ρωτάει «μήπως κάθε μονόδρομη διόρθωση προς την
 * ασφάλεια μάς έκανε σιγά-σιγά να λέμε “πρόσεχε” παντού;» — και μέσα σε πέντε εβδομάδες μπήκαν πολλές
 * τέτοιες. Ένα προϊόν που φοβάται τα πάντα είναι το ίδιο άχρηστο με ένα που δεν φοβάται τίποτα.
 *
 * ΤΙ ΣΥΓΚΡΙΝΕΙ. Την ΕΤΥΜΗΓΟΡΙΑ ΚΟΛΥΜΒΗΣΗΣ (`BeachScore.swimmingComfort`: excellent / good / caution /
 * avoid_swimming) και τη ΒΑΘΜΟΛΟΓΙΑ (`finalSuitabilityScore`), ανά παραλία και ανά μέρα, ανάμεσα σε:
 *   Α) τον κώδικα της 05/08/2026 (commit `23828152`, το «κλείδωμα» της αξιολόγησης §ΑΞ1), και
 *   Β) τον σημερινό κώδικα.
 * Το `BeachScore` και το `SwimmingComfort` είναι **ταυτόσημα** στις δύο εκδόσεις (ελέγχθηκε 14/09:
 * ίδια πεδία, ίδιες τέσσερις τιμές), οπότε η σύγκριση είναι ένα προς ένα και χωρίς μετάφραση.
 *
 * ΤΟ ΔΥΣΚΟΛΟ: ΙΔΙΟΣ ΚΑΙΡΟΣ ΚΑΙ ΣΤΙΣ ΔΥΟ. Δύο τρεξίματα σε διαφορετική ώρα βλέπουν διαφορετική
 * πρόγνωση, και η διαφορά τους δεν είναι κώδικας — είναι ο καιρός. Γι᾽ αυτό εδώ ο καιρός ΗΧΟΓΡΑΦΕΙΤΑΙ
 * μία φορά (`--record`) και ΞΑΝΑΠΑΙΖΕΤΑΙ (`--replay`) στην άλλη έκδοση. Η ηχογράφηση γίνεται **ανά
 * ΣΗΜΕΙΟ**, όχι ανά URL: οι δύο εκδόσεις μπορεί να ομαδοποιούν τα σημεία αλλιώς ή να ζητούν άλλη λίστα
 * μεταβλητών, και ένα κλειδί «ολόκληρο το URL» θα αστοχούσε σιωπηλά. Αν η παλιά έκδοση ζητήσει σημείο
 * που δεν ηχογραφήθηκε, το σκριπτ ΦΩΝΑΖΕΙ και μετράει την περιοχή ως παραλειπόμενη — δεν μαντεύει.
 *
 * ΑΠΟΜΟΝΩΝΕΙ ΤΟΝ ΚΩΔΙΚΑ, ΟΧΙ ΤΑ ΔΕΔΟΜΕΝΑ. Το worktree της 05/08 κουβαλάει και τα ΔΕΔΟΜΕΝΑ της 05/08
 * (παραλίες, γεωμετρία). Αν τρέξει έτσι, η διαφορά θα ανακατεύει «άλλαξε ο κανόνας» με «άλλαξε η
 * παραλία». Γι᾽ αυτό ο φάκελος `public/data` του παλιού worktree δείχνει (junction) στου σημερινού:
 * **ίδια δεδομένα, ίδιος καιρός, μόνο ο κώδικας διαφέρει.** Αυτό είναι που ρωτάει το ταμπλό.
 *
 * ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ: ποια από τις δύο εκδόσεις έχει ΔΙΚΙΟ. Μετρά ΜΕΤΑΤΟΠΙΣΗ, όχι ακρίβεια — αν οι
 * διορθώσεις ήταν σωστές, η μετατόπιση είναι το τίμημά τους και είναι αποδεκτή. Ο αριθμός λέει μόνο
 * πόσο μεγάλο είναι το τίμημα, ώστε να μην το ανακαλύψουμε από παράπονα.
 *
 *   # 1. στο σημερινό δέντρο — ηχογράφηση καιρού + σημερινή ετυμηγορία
 *   node scripts/measureConservatismDrift.mjs --record=.tmp/drift-weather.json --out=.tmp/drift-today.json
 *   # 2. στο worktree της 05/08 (με junction public/data → σημερινό) — ίδιος καιρός, παλιός κώδικας
 *   node scripts/measureConservatismDrift.mjs --replay=<abs>/.tmp/drift-weather.json --out=<abs>/.tmp/drift-0508.json
 *   # 3. σύγκριση
 *   node scripts/measureConservatismDrift.mjs --compare=.tmp/drift-0508.json,.tmp/drift-today.json
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argVal = (name, fallback = null) => { const hit = process.argv.find(a => a.startsWith(`${name}=`)); return hit ? hit.slice(name.length + 1) : fallback; };
const RECORD = argVal('--record'), REPLAY = argVal('--replay'), COMPARE = argVal('--compare');
const OUT = argVal('--out', '.tmp/drift-run.json');
const DAYS = Number(argVal('--days', '2'));
const regionFilter = argVal('--regions')?.split(',');

// ── 3. Σύγκριση δύο τρεξιμάτων — δεν χρειάζεται τίποτα από τη μηχανή ──────────────────────────
if (COMPARE) {
  const [aPath, bPath] = COMPARE.split(',');
  const A = JSON.parse(readFileSync(path.resolve(root, aPath), 'utf8'));
  const B = JSON.parse(readFileSync(path.resolve(root, bPath), 'utf8'));
  const RANK = { excellent: 0, good: 1, caution: 2, avoid_swimming: 3 };
  const key = r => `${r.beachId}|${r.day}`;
  const mapA = new Map(A.rows.map(r => [key(r), r])), mapB = new Map(B.rows.map(r => [key(r), r]));
  const shared = [...mapA.keys()].filter(k => mapB.has(k));
  let stricter = 0, milder = 0, same = 0, scoreDelta = 0, scored = 0;
  const moves = {}, examples = { stricter: [], milder: [] };
  for (const k of shared) {
    const a = mapA.get(k), b = mapB.get(k);
    const ra = RANK[a.verdict], rb = RANK[b.verdict];
    if (rb > ra) { stricter += 1; moves[`${a.verdict}→${b.verdict}`] = (moves[`${a.verdict}→${b.verdict}`] || 0) + 1; if (examples.stricter.length < 12) examples.stricter.push({ ...b, was: a.verdict, scoreWas: a.score }); }
    else if (rb < ra) { milder += 1; moves[`${a.verdict}→${b.verdict}`] = (moves[`${a.verdict}→${b.verdict}`] || 0) + 1; if (examples.milder.length < 12) examples.milder.push({ ...b, was: a.verdict, scoreWas: a.score }); }
    else same += 1;
    if (typeof a.score === 'number' && typeof b.score === 'number') { scoreDelta += b.score - a.score; scored += 1; }
  }
  const pct = n => Number((100 * n / Math.max(1, shared.length)).toFixed(2));
  const out = {
    generatedAt: new Date().toISOString(), baseline: { file: aPath, label: A.label, commit: A.commit }, current: { file: bPath, label: B.label, commit: B.commit },
    comparedBeachDays: shared.length, onlyInBaseline: mapA.size - shared.length, onlyInCurrent: mapB.size - shared.length,
    stricter, milder, same, stricterPct: pct(stricter), milderPct: pct(milder), netDriftPct: Number((pct(stricter) - pct(milder)).toFixed(2)),
    meanScoreDeltaPoints: scored ? Number((scoreDelta / scored).toFixed(2)) : null,
    moves: Object.fromEntries(Object.entries(moves).sort((x, y) => y[1] - x[1])), examples,
    reading: 'netDriftPct > 0 σημαίνει ότι ο σημερινός κώδικας λέει «χειρότερα» πιο συχνά απ᾽ ό,τι ο παλιός, στον ΙΔΙΟ καιρό και στα ΙΔΙΑ δεδομένα.',
  };
  const outFile = path.resolve(root, OUT === '.tmp/drift-run.json' ? `reports/quality/conservatism-drift-${new Date().toISOString().slice(0, 10)}.json` : OUT);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\n=== ΜΕΤΑΤΟΠΙΣΗ ΣΥΝΤΗΡΗΤΙΣΜΟΥ: ${A.label} → ${B.label} ===`);
  console.log(`  παραλίες-μέρες που συγκρίθηκαν: ${out.comparedBeachDays.toLocaleString('el')}${out.onlyInBaseline || out.onlyInCurrent ? ` (μόνο στο παλιό ${out.onlyInBaseline}, μόνο στο νέο ${out.onlyInCurrent})` : ''}`);
  console.log(`  ΑΥΣΤΗΡΟΤΕΡΑ ${out.stricter.toLocaleString('el')} (${out.stricterPct}%) · ΗΠΙΟΤΕΡΑ ${out.milder.toLocaleString('el')} (${out.milderPct}%) · ίδια ${out.same.toLocaleString('el')}`);
  console.log(`  ΚΑΘΑΡΗ ΜΕΤΑΤΟΠΙΣΗ: ${out.netDriftPct > 0 ? '+' : ''}${out.netDriftPct}% προς ${out.netDriftPct > 0 ? 'το αυστηρότερο' : 'το ηπιότερο'} · μέση μεταβολή βαθμού ${out.meanScoreDeltaPoints} πόντοι`);
  for (const [m, n] of Object.entries(out.moves)) console.log(`    ${m.padEnd(34)} ${n}`);
  console.log(`→ ${path.relative(root, outFile)}`);
  process.exit(0);
}

// ── Μηχανή ───────────────────────────────────────────────────────────────────────────────────
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.recordOpenMeteoCall = function () {};\n', filename);
    return;
  }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

// ── Ο καιρός: ηχογράφηση/επανάληψη ΑΝΑ ΣΗΜΕΙΟ ΚΑΙ ΑΝΑ ΑΙΤΗΜΑ ─────────────────────────────────
// ΔΙΟΡΘΩΘΗΚΕ 14/09/2026 (βίβλος §Γ85). Το κλειδί ήταν μόνο διαδρομή + σημείο, αλλά για κάθε σημείο
// θάλασσας η σελίδα κάνει ΤΡΙΑ αιτήματα στο /v1/marine (ewam · ουρά meteofrance_wave · θερμοκρασία
// νερού — services/weatherService fetchMarineForecastData) και κρατιόταν όποιο έφτανε τελευταίο: στην
// ηχογράφηση της 14/09 10:21, 604/2.867 σημεία (21%) είχαν ΜΟΝΟ θερμοκρασία νερού, οπότε στο
// ξαναπαίξιμο το κύμα χανόταν. Μετρημένο: ίδιος κώδικας, ζωντανά vs ξαναπαίξιμο → 436/5.712
// παραλίες-μέρες (7,6%) «άλλαζαν» χωρίς καμία αλλαγή κώδικα. Ηχογραφήσεις πριν από αυτή τη γραμμή
// ΔΕΝ ξαναπαίζονται με το νέο κλειδί — ξαναγράψε τις.
const requestSignature = (u) => [...u.searchParams.entries()]
  .filter(([k]) => !['latitude', 'longitude', 'apikey', 'start_date', 'end_date'].includes(k))
  .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
const pointKey = (u, lat, lon) => `${u.pathname}|${requestSignature(u)}|${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
const store = REPLAY ? JSON.parse(readFileSync(path.resolve(REPLAY), 'utf8')) : {};
let recorded = 0, replayed = 0;
const missingPoints = new Set();
const originalFetch = globalThis.fetch;
const PAID_HOST = { 'https://api.open-meteo.com': 'https://customer-api.open-meteo.com', 'https://marine-api.open-meteo.com': 'https://customer-marine-api.open-meteo.com' };

if (RECORD || REPLAY) {
  const apiKey = RECORD ? (process.env.OPEN_METEO_API_KEY?.trim() || (await import('./lib/openMeteoKey.mjs').then(m => m.resolveOpenMeteoKey()).catch(() => null))) : null;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (typeof url !== 'string' || !/open-meteo\.com/.test(url)) return originalFetch(input, init);
    const u = new URL(url);
    const lats = (u.searchParams.get('latitude') || '').split(',').filter(Boolean);
    const lons = (u.searchParams.get('longitude') || '').split(',').filter(Boolean);
    if (REPLAY) {
      const rows = [];
      for (let i = 0; i < lats.length; i += 1) {
        const k = pointKey(u, lats[i], lons[i]);
        if (!(k in store)) { missingPoints.add(k); rows.push(null); continue; }
        rows.push(store[k]);
      }
      if (rows.some(r => r === null)) throw new Error(`ΞΑΝΑΠΑΙΞΙΜΟ: λείπουν ${rows.filter(r => r === null).length}/${rows.length} σημεία από την ηχογράφηση (${u.pathname})`);
      replayed += rows.length;
      return new Response(JSON.stringify(rows.length === 1 ? rows[0] : rows), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    let target = url;
    if (apiKey) for (const [free, paid] of Object.entries(PAID_HOST)) if (target.startsWith(free)) target = `${paid}${target.slice(free.length)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await originalFetch(target, init);
    const json = await res.clone().json();
    const rows = Array.isArray(json) ? json : [json];
    rows.forEach((r, i) => { if (lats[i] !== undefined) { store[pointKey(u, lats[i], lons[i])] = r; recorded += 1; } });
    return new Response(JSON.stringify(json), { status: res.status, headers: { 'content-type': 'application/json' } });
  };
  console.log(RECORD ? `  Ηχογράφηση καιρού → ${RECORD}${apiKey ? ' (πληρωμένη πόρτα)' : ''}` : `  Επανάληψη καιρού ← ${REPLAY} (${Object.keys(store).length} σημεία)`);
}

const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } = require(path.join(root, 'services/weatherService.ts'));

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const p of Object.values(profilesRaw ?? {})) if (p?.beachId != null) profiles[p.beachId] = p;
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, regionPoint: app.island.coordinates, profiles };
  } catch { return null; }
};
const regions = readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json').map(loadRegion).filter(Boolean)
  .filter(r => r.regionPoint && Number.isFinite(r.regionPoint.lat)).filter(r => !regionFilter || regionFilter.includes(r.regionId));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = [];
let done = 0, skipped = 0;
const skippedRegions = [];
for (const region of regions) {
  try {
    const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
    const [windByPoint, marineByPoint] = await Promise.all([fetchForecastDataBatch([region.regionPoint]), fetchMarineForecastDataBatch(resolution.points)]);
    const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
    if (!wind) { skipped += 1; skippedRegions.push(`${region.regionId}: χωρίς άνεμο`); continue; }
    const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
    const processed = processForecastData(mergeMarineForecastData(wind.data, regionMarine));
    for (let dayIndex = 0; dayIndex < Math.min(DAYS, processed.length); dayIndex += 1) {
      const regionDay = processed[dayIndex];
      if (!regionDay) continue;
      for (const beach of region.beaches) {
        const key = resolution.keyByBeachId.get(beach.id);
        const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
        const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;
        const score = calculateBeachScore(beach, dayForecast, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: region.profiles[beach.id] });
        rows.push({ beachId: beach.id, regionId: region.regionId, day: dayIndex, verdict: score?.swimmingComfort ?? null, score: typeof score?.finalSuitabilityScore === 'number' ? Number(score.finalSuitabilityScore.toFixed(2)) : null, total: typeof score?.total === 'number' ? Number(score.total.toFixed(2)) : null });
      }
    }
    done += 1;
    process.stderr.write(`\r  ${done}/${regions.length} περιοχές · ${rows.length} παραλίες-μέρες`);
    if (RECORD) await sleep(200);
  } catch (e) { skipped += 1; skippedRegions.push(`${region.regionId}: ${e.message}`); process.stderr.write(`\n  ${region.regionId}: ${e.message}\n`); }
}
process.stderr.write('\n');
if (RECORD) { mkdirSync(path.dirname(path.resolve(root, RECORD)), { recursive: true }); writeFileSync(path.resolve(root, RECORD), JSON.stringify(store)); console.log(`  Ηχογραφήθηκαν ${recorded} απαντήσεις σημείων → ${RECORD}`); }
if (REPLAY) console.log(`  Ξαναπαίχτηκαν ${replayed} απαντήσεις σημείων${missingPoints.size ? ` · ΛΕΙΠΑΝ ${missingPoints.size} σημεία` : ''}`);

const verdicts = {};
for (const r of rows) verdicts[r.verdict ?? 'null'] = (verdicts[r.verdict ?? 'null'] || 0) + 1;
const out = {
  generatedAt: new Date().toISOString(), label: argVal('--label', RECORD ? 'σημερινός κώδικας' : 'κώδικας 05/08/2026'),
  commit: argVal('--commit', null), days: DAYS, regions: done, regionsSkipped: skipped, skippedRegions: skippedRegions.slice(0, 20),
  beachDays: rows.length, verdictCounts: verdicts, rows,
};
const outFile = path.resolve(root, OUT);
mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`);
console.log(`  ${out.label}: ${rows.length.toLocaleString('el')} παραλίες-μέρες · ${JSON.stringify(verdicts)}`);
console.log(`→ ${path.relative(root, outFile)}`);
