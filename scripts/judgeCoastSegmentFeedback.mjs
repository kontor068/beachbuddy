// Ο ΚΡΙΤΗΣ ΤΩΝ «ΣΥΣΤΗΜΑΤΙΚΩΝ» ΤΜΗΜΑΤΩΝ ΑΚΤΗΣ (13/09/2026, βίβλος §Γ81 Δ2-Β → Δ2-Δ).
//
// Το analyzeFeedbackByCoast.mjs βρήκε δύο τμήματα όπου τα παράπονα μαζεύονται: ΝΔ Αττική
// («αέρας / κύμα» ενώ δείχναμε 1-3 Μποφόρ) και δυτική Λευκάδα («κύμα» σε «προστατευμένη»).
// Αυτό το εργαλείο βάζει κάθε τέτοιο σχόλιο απέναντι σε έναν κριτή που ΔΕΝ είναι η σελίδα:
// το αρχείο του ίδιου μοντέλου (past_days στους πληρωμένους hosts της Open-Meteo, ως 92 μέρες
// πίσω) στο ΣΗΜΕΙΟ ΤΗΣ ΠΑΡΑΛΙΑΣ (όχι της περιοχής), και το θαλάσσιο αρχείο στο σημείο κύματος
// που διαλέγει η ίδια η σελίδα για την παραλία (utils/marineSamplePoints). Έτσι χωρίζουμε:
//   (α) η σελίδα έδειξε ΛΙΓΟΤΕΡΟ απ' ό,τι το ίδιο μοντέλο λέει ότι είχε εκεί την ώρα εκείνη
//       → σφάλμα δικό μας (σημείο, στρώματα, ώρα)·
//   (β) η σελίδα έδειξε ΟΣΟ και το μοντέλο → το σχόλιο διαφωνεί με το μοντέλο ή με τη λέξη
//       («προστατευμένη» με 5 Μποφόρ απόγειο = ήρεμο νερό αλλά αέρας στην άμμο)·
//   (γ) η ώρα του σχολίου είναι αβέβαιη (πριν από τις 29/08 δεν γραφόταν η ώρα της οθόνης).
//
// ⚠️ Το αρχείο του μοντέλου ΔΕΝ είναι όργανο. Είναι «τι λέει το μοντέλο ότι έγινε», που
// είναι αρκετό για το (α) — αν διαφέρει από αυτό που δείξαμε, φταίμε εμείς — αλλά όχι για να
// πούμε ότι ο επισκέπτης έκανε λάθος. Σταθμός στην ακτή (meteo.gr Γλυφάδα/Ελληνικό) δίνει μόνο
// ημερήσια σύνοψη· δεν κρίνει ώρες. Βλ. memory meteo-gr-station-judge.
//
//   node scripts/judgeCoastSegmentFeedback.mjs --input <feedback-export.json>
//        [--segments reports/feedback/coast-segments-2026-09-13.json] [--out reports/feedback/coast-judge-<σήμερα>.json]
//        [--pastDays=92]
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argVal = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`${name}=`)); if (hit) return hit.slice(name.length + 1); const i = process.argv.indexOf(name); return i === -1 ? fallback : process.argv[i + 1]; };
const today = new Date().toISOString().slice(0, 10);
const inputPath = argVal('--input', '.tmp/feedback-export.json');
const segmentsPath = argVal('--segments', 'reports/feedback/coast-segments-2026-09-13.json');
const outPath = argVal('--out', `reports/feedback/coast-judge-${today}.json`);
const PAST_DAYS = Number(argVal('--pastDays', '92'));

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));

const apiKey = await resolveOpenMeteoKey();
if (!apiKey) { console.error('Χωρίς κλειδί Open-Meteo (OPEN_METEO_API_KEY) — οι πληρωμένοι hosts είναι οι μόνοι με past_days=92.'); process.exit(1); }

// ── Παραλίες, σημεία, προφίλ (ίδια πηγή με τη σελίδα) ─────────────────────────────────────
const appDir = path.join(root, 'public/data/beaches/app');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const regions = new Map();
for (const file of readdirSync(appDir).filter(n => n.endsWith('.json'))) {
  const regionId = file.replace(/\.json$/, '');
  const app = JSON.parse(readFileSync(path.join(appDir, file), 'utf8'));
  const beaches = app?.island?.beaches ?? [];
  const regionPoint = app?.island?.coordinates;
  let profiles = {};
  try {
    const raw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    for (const p of Object.values(raw ?? {})) if (p?.beachId != null) profiles[p.beachId] = p;
  } catch { /* περιοχή χωρίς προφίλ έκθεσης: το κύμα πέφτει στο σημείο περιοχής */ }
  regions.set(regionId, { regionId, beaches, regionPoint, profiles });
}
const beachIndex = new Map(); // beachId → { regionId, beach }
for (const region of regions.values()) for (const b of region.beaches) {
  if (beachIndex.has(b.id)) console.warn(`⚠️ διπλό id παραλίας ${b.id}: ${beachIndex.get(b.id).regionId} και ${region.regionId}`);
  beachIndex.set(b.id, { regionId: region.regionId, beach: b });
}

// ── Ποια σχόλια κρίνουμε: τα «συστηματικά» τμήματα της αναφοράς ───────────────────────────
const segmentsReport = JSON.parse(readFileSync(path.resolve(root, segmentsPath), 'utf8'));
const systematic = segmentsReport.systematic ?? [];
const wanted = new Map(); // beachId → segment
for (const seg of systematic) for (const b of seg.beaches ?? []) wanted.set(b.beachId, { seg, facingDeg: b.facingDeg ?? null });
const feedback = JSON.parse(readFileSync(path.resolve(root, inputPath), 'utf8'));
const records = (Array.isArray(feedback) ? feedback : []).filter(r => wanted.has(r?.beachId) && r?.conditions?.date);

// ── Αρχείο μοντέλου: μία λήψη ανά σημείο, μνήμη ────────────────────────────────────────────
const WIND_HOST = 'https://customer-api.open-meteo.com/v1/forecast';
const MARINE_HOST = 'https://customer-marine-api.open-meteo.com/v1/marine';
const cache = new Map();
const getJson = async (url) => {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`${res.status} ${json.reason || ''}`.trim());
  return json;
};
const windArchive = async (lat, lon) => {
  const key = `w|${marinePointKey(lat, lon)}`;
  if (!cache.has(key)) {
    const url = `${WIND_HOST}?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&past_days=${PAST_DAYS}&forecast_days=1&timezone=Europe%2FAthens&wind_speed_unit=kmh&apikey=${apiKey}`;
    cache.set(key, getJson(url).then(j => j.hourly));
  }
  return cache.get(key);
};
const marineArchive = async (lat, lon) => {
  const key = `m|${marinePointKey(lat, lon)}`;
  if (!cache.has(key)) {
    const vars = 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height';
    // Δύο μοντέλα, όπως η σελίδα (§Γ43): ewam πρώτα· όπου το κελί του ewam είναι στεριά (null ή
    // ακριβώς 0 — π.χ. το σημείο περιοχής της Αττικής πάνω στη Γλυφάδα) η σελίδα διαβάζει το
    // meteofrance_wave. Εδώ κρατάμε ΚΑΙ τα δύο και διαλέγουμε ανά ώρα, λέγοντας ποιο μίλησε.
    cache.set(key, (async () => {
      const fetchModel = async (models) => {
        const url = `${MARINE_HOST}?latitude=${lat}&longitude=${lon}&hourly=${vars}&past_days=${PAST_DAYS}&forecast_days=1&timezone=Europe%2FAthens&models=${models}&apikey=${apiKey}`;
        try { return (await getJson(url)).hourly ?? null; } catch { return null; }
      };
      const [ewam, mf] = await Promise.all([fetchModel('ewam'), fetchModel('meteofrance_wave')]);
      if (!ewam && !mf) return null;
      return { ewam, mf };
    })());
  }
  return cache.get(key);
};
const at = (hourly, date, hour, field) => {
  if (!hourly?.time) return null;
  const i = hourly.time.indexOf(`${date}T${String(hour).padStart(2, '0')}:00`);
  return i === -1 ? null : (hourly[field]?.[i] ?? null);
};
const r1 = (v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null);
const compassDeg = { North: 0, Northeast: 45, East: 90, Southeast: 135, South: 180, Southwest: 225, West: 270, Northwest: 315 };
const angleDiff = (a, b) => { if (a == null || b == null) return null; const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };

// ── Κρίση ανά σχόλιο ───────────────────────────────────────────────────────────────────────
const rows = [];
for (const record of records) {
  const c = record.conditions;
  const { seg, facingDeg } = wanted.get(record.beachId);
  const entry = beachIndex.get(record.beachId);
  if (!entry) { rows.push({ beachId: record.beachId, skipped: 'άγνωστη παραλία' }); continue; }
  const region = regions.get(entry.regionId);
  const beach = entry.beach;
  const bLat = beach.coordinates?.lat, bLon = beach.coordinates?.lon;
  const hourShown = typeof c.shownHour === 'number' ? c.shownHour : c.hour;
  // Πριν από τις 29/08 δεν γραφόταν η ώρα της οθόνης· χωρίς «τώρα είμαι εκεί» δεν ξέρουμε ούτε αν
  // ήταν εκεί εκείνη την ώρα. Κρίνουμε την ώρα του κλικ και το ΛΕΜΕ.
  const hourCertain = typeof c.shownHour === 'number' || c.observedTiming === 'now';
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
  const marineKey = resolution.keyByBeachId.get(record.beachId) ?? marinePointKey(region.regionPoint.lat, region.regionPoint.lon);
  const marinePoint = resolution.points.find(p => marinePointKey(p.lat, p.lon) === marineKey) ?? region.regionPoint;

  const [wBeach, wRegion, marine] = await Promise.all([
    windArchive(bLat, bLon).catch(e => ({ error: String(e.message) })),
    windArchive(region.regionPoint.lat, region.regionPoint.lon).catch(e => ({ error: String(e.message) })),
    marineArchive(marinePoint.lat, marinePoint.lon).catch(e => ({ error: String(e.message) })),
  ]);
  const wind = (h) => h?.error ? { error: h.error } : {
    kmh: r1(at(h, c.date, hourShown, 'wind_speed_10m')),
    bft: (() => { const v = at(h, c.date, hourShown, 'wind_speed_10m'); return typeof v === 'number' ? getBeaufortLevel(v) : null; })(),
    dirDeg: at(h, c.date, hourShown, 'wind_direction_10m'),
    gustKmh: r1(at(h, c.date, hourShown, 'wind_gusts_10m')),
    // Και η χειρότερη ώρα της μέρας 10-18, γιατί ο επισκέπτης θυμάται τη ριπή, όχι τον μέσο όρο.
    dayMaxKmh10to18: (() => { let m = null; for (let hh = 10; hh <= 18; hh++) { const v = at(h, c.date, hh, 'wind_speed_10m'); if (typeof v === 'number' && (m == null || v > m)) m = v; } return r1(m); })(),
  };
  // Ανά ώρα: ewam αν το κελί του έχει νερό (>0), αλλιώς meteofrance_wave — όπως η σελίδα στα σημεία
  // όπου το κελί του ewam «περιγράφει νερό που η παραλία δεν βλέπει» (weatherService §Γ43).
  const ewamHs = marine && !marine.error ? at(marine.ewam, c.date, hourShown, 'wave_height') : null;
  const useEwam = typeof ewamHs === 'number' && ewamHs > 0;
  const seaHourly = marine && !marine.error ? (useEwam ? marine.ewam : marine.mf) : null;
  const pick = (field) => at(seaHourly, c.date, hourShown, field);
  const sea = marine?.error ? { error: marine.error } : seaHourly ? {
    model: useEwam ? 'ewam' : 'meteofrance_wave',
    ewamHsM: r1(ewamHs),
    hsM: r1(pick('wave_height')),
    dirDeg: pick('wave_direction'),
    periodS: r1(pick('wave_period')),
    swellM: r1(pick('swell_wave_height')),
    swellDirDeg: pick('swell_wave_direction'),
    swellPeriodS: r1(pick('swell_wave_period')),
    windWaveM: r1(pick('wind_wave_height')),
    point: { lat: marinePoint.lat, lon: marinePoint.lon },
  } : { error: 'κενό αρχείο' };

  const shown = { bft: c.beaufort ?? null, bftShown: c.beaufortShown ?? null, dir: c.windDir ?? null, exposure: c.exposureLevel ?? null, seaM: c.seaStateWaveM ?? null, shoreM: c.shoreDisplayWaveM ?? null };
  const wb = wind(wBeach), wr = wind(wRegion);
  const judgement = [];
  if (typeof wb.bft === 'number' && typeof shown.bft === 'number') {
    const d = wb.bft - shown.bft;
    if (d >= 1) judgement.push(`ΑΝΕΜΟΣ: η σελίδα έδειξε ${shown.bft} Μπφ, το αρχείο στην παραλία λέει ${wb.bft} Μπφ (${wb.kmh} χλμ/ώ, ριπή ${wb.gustKmh}) — υπο-έδειξε κατά ${d}`);
    else if (d <= -1) judgement.push(`ΑΝΕΜΟΣ: η σελίδα έδειξε ${shown.bft} Μπφ, το αρχείο ${wb.bft} Μπφ — υπερ-έδειξε κατά ${-d}`);
    else judgement.push(`ΑΝΕΜΟΣ: σελίδα και αρχείο συμφωνούν (${shown.bft} ≈ ${wb.bft} Μπφ, ριπή ${wb.gustKmh})`);
    if (typeof wr.bft === 'number' && wr.bft !== wb.bft) judgement.push(`σημείο περιοχής ${wr.bft} Μπφ ≠ σημείο παραλίας ${wb.bft} Μπφ`);
    const offshore = facingDeg != null && wb.dirDeg != null ? angleDiff(wb.dirDeg, facingDeg) > 110 : null;
    if (offshore === true && wb.bft >= 4) judgement.push('απόγειος ≥4 Μπφ: ήρεμο νερό αλλά αέρας στην άμμο — η λέξη «προστατευμένη» διαβάζεται ως «απάνεμη»');
    if (typeof wb.gustKmh === 'number' && wb.gustKmh >= 45) judgement.push(`ριπές ${wb.gustKmh} χλμ/ώ`);
  }
  if (typeof sea.hsM === 'number') {
    const ref = typeof shown.seaM === 'number' ? shown.seaM : null;
    if (ref != null) {
      const d = sea.hsM - ref;
      if (d >= 0.15) judgement.push(`ΚΥΜΑ: η σελίδα έδειξε ${ref} μ. ανοιχτά, το αρχείο ${sea.hsM} μ. (${sea.model}) — υπο-έδειξε κατά ${r1(d)} μ.`);
      else if (d <= -0.15) judgement.push(`ΚΥΜΑ: σελίδα ${ref} μ. > αρχείο ${sea.hsM} μ. — υπερ-έδειξε`);
      else judgement.push(`ΚΥΜΑ: σελίδα ${ref} μ. ≈ αρχείο ${sea.hsM} μ. (T ${sea.periodS} s, φουσκοθαλασσιά ${sea.swellM} μ. από ${sea.swellDirDeg}°)`);
    }
    const onshoreSwell = facingDeg != null && sea.swellDirDeg != null && typeof sea.swellM === 'number' && sea.swellM >= 0.2 && angleDiff(sea.swellDirDeg, facingDeg) <= 70;
    const offshoreWind = facingDeg != null && wb.dirDeg != null && angleDiff(wb.dirDeg, facingDeg) > 110;
    if (onshoreSwell && offshoreWind) judgement.push(`φουσκοθαλασσιά ${sea.swellM} μ. ΜΠΑΙΝΕΙ στην ακτή ενώ ο άνεμος είναι απόγειος — «προστατευμένη» από τον άνεμο, όχι από τη θάλασσα (Δ11)`);
  }
  if (!hourCertain) judgement.push('ώρα αβέβαιη (πριν από 29/08 χωρίς ώρα οθόνης) — κρίθηκε η ώρα του κλικ');

  rows.push({
    beachId: record.beachId, name: beach.name?.en ?? String(record.beachId), region: entry.regionId, sector: seg.sector, facingDeg,
    verdict: record.feedback, alsoReported: record.alsoReported ?? [], date: c.date, hour: hourShown, hourCertain, observedTiming: c.observedTiming ?? null,
    shown, archive: { beach: wb, region: wr, sea }, judgement,
  });
}

// ── Σύνοψη ανά τμήμα ───────────────────────────────────────────────────────────────────────
const summary = {};
for (const row of rows) {
  if (row.skipped) continue;
  const key = `${row.region} ${row.sector}`;
  const s = summary[key] || (summary[key] = { records: 0, hourCertain: 0, windUnderShown: 0, windAgreed: 0, windOverShown: 0, seaUnderShown: 0, seaAgreed: 0, offshoreStrong: 0, swellIntoOffshoreWind: 0, regionPointDiffers: 0 });
  s.records += 1; if (row.hourCertain) s.hourCertain += 1;
  for (const j of row.judgement) {
    if (j.startsWith('ΑΝΕΜΟΣ') && j.includes('υπο-έδειξε')) s.windUnderShown += 1;
    else if (j.startsWith('ΑΝΕΜΟΣ') && j.includes('υπερ-έδειξε')) s.windOverShown += 1;
    else if (j.startsWith('ΑΝΕΜΟΣ')) s.windAgreed += 1;
    if (j.startsWith('ΚΥΜΑ') && j.includes('υπο-έδειξε')) s.seaUnderShown += 1;
    else if (j.startsWith('ΚΥΜΑ') && j.includes('≈')) s.seaAgreed += 1;
    if (j.startsWith('απόγειος')) s.offshoreStrong += 1;
    if (j.startsWith('φουσκοθαλασσιά')) s.swellIntoOffshoreWind += 1;
    if (j.startsWith('σημείο περιοχής')) s.regionPointDiffers += 1;
  }
}

mkdirSync(path.dirname(path.resolve(root, outPath)), { recursive: true });
writeFileSync(path.resolve(root, outPath), JSON.stringify({
  generatedAt: new Date().toISOString(), input: inputPath, segments: segmentsPath, pastDays: PAST_DAYS,
  judge: 'Open-Meteo past_days (πληρωμένοι hosts) στο σημείο της παραλίας + θαλάσσιο σημείο της σελίδας — αρχείο μοντέλου, ΟΧΙ όργανο',
  summary, rows,
}, null, 2), 'utf8');

console.log(`=== ΚΡΙΤΗΣ ΤΜΗΜΑΤΩΝ ΑΚΤΗΣ — ${rows.length} σχόλια, ${systematic.length} τμήματα ===`);
for (const row of rows) {
  if (row.skipped) { console.log(`  #${row.beachId}: ${row.skipped}`); continue; }
  console.log(`  #${row.beachId} ${row.name} (${row.sector}) ${row.date} ${String(row.hour).padStart(2, '0')}:00${row.hourCertain ? '' : '?'} [${row.verdict}] έδειχνε ${row.shown.bft} Μπφ ${row.shown.dir ?? ''} ${row.shown.exposure ?? ''} ${row.shown.seaM ?? '–'} μ.`);
  for (const j of row.judgement) console.log(`      · ${j}`);
}
console.log('\n--- σύνοψη');
for (const [key, s] of Object.entries(summary)) console.log(`  ${key}: ${JSON.stringify(s)}`);
console.log(`\nΑναφορά: ${outPath}`);
