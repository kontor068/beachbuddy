#!/usr/bin/env node
/**
 * ΤΟ ΤΑΜΠΛΟ ΕΙΛΙΚΡΙΝΕΙΑΣ — έξι αριθμοί που λένε αν λέμε αλήθεια στον κόσμο (12/09/2026, βίβλος §Γ81).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Οι 89 πύλες του `quality:critical` ρωτάνε σχεδόν όλες «συμφωνούμε με τον εαυτό μας;»
 * (3 από τις 89 ρωτάνε τον κόσμο). Το «ασφάλεια 99,95%» του §Γ41 ήταν συνέπεια κάρτας↔πινέζας, όχι
 * αλήθεια απέναντι σε όργανο. Το `external-scorecard.json` του §ΑΞ1/Α6 γράφτηκε μία φορά (21/08) και
 * δεν ξαναγράφτηκε. Αυτό εδώ είναι το αντίθετο: ΜΟΝΟ αριθμοί με εξωτερικό κριτή, κάθε ένας με
 * παρονομαστή, παράθυρο και ηλικία — γιατί ποσοστό χωρίς παρονομαστή είναι διαφήμιση, και μέτρηση
 * χωρίς ημερομηνία είναι ανάμνηση.
 *
 * ΤΙ ΔΙΑΒΑΖΕΙ (τίποτα δεν εφευρίσκεται — κάθε αριθμός δείχνει αρχείο):
 *   1. reports/weather/station-truth-latest.json      βαριά ψεύτικη ηρεμία ανέμου (μπλε σε πορτοκαλί/κόκκινο
 *                                                      όργανο), 30 METAR — γράφεται από validateColourAgainstStations
 *   2. το ίδιο                                          ψεύτικος συναγερμός ανέμου (πορτοκαλί/κόκκινο σε μπλε όργανο)
 *   3. reports/wave-model/shore-surf-national.json     ψεύτικη ηρεμία στην ΑΜΜΟ: τυπώνουμε ≤0,3 μ., ο Sentinel-2 βλέπει αφρό
 *   4. reports/feedback/calibration-*.json (νεότερο)   άνθρωποι στην άμμο: σχόλια επιτόπου ανά εβδομάδα
 *   5. —                                                μετατόπιση συντηρητισμού vs 05/08 (§ΑΞ1/Α7): ΔΕΝ ΜΕΤΡΗΘΗΚΕ ΠΟΤΕ — μένει κενό
 *                                                      επίτηδες ώστε να φαίνεται, ως τη Δ6
 *   6. οι ημερομηνίες των 1-4 + σημαδούρες             μέρες από την τελευταία εξωτερική μέτρηση (η μεγαλύτερη)
 *
 * ΤΙ ΓΡΑΦΕΙ:
 *   reports/quality/honesty-scorecard.json                 append-only ιστορικό (μία γραμμή ανά μέρα· ίδια μέρα = αντικατάσταση)
 *   netlify/functions/lib/honestyScorecard.generated.mjs   η τελευταία γραμμή, για το εβδομαδιαίο Telegram (quality-digest)
 *
 * ΚΟΚΚΙΝΕΣ ΓΡΑΜΜΕΣ (γραμμένες εδώ, όχι στο μήνυμα): 1 >10% (ίδιο με τον φύλακα) · 2 >12% · 3 >3% · 4 <1/εβδ ·
 * 5 >10%/μήνα · 6 >30 μέρες. Το script ΔΕΝ κόβει build — τυπώνει και γράφει. Το «τι κάνουμε» το λέει ο άνθρωπος.
 *
 * Run: node scripts/buildHonestyScorecard.mjs        (npm run quality:honesty)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(root, p).replace(/\\/g, '/');
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
// Μικρό glob χωρίς εξάρτηση: το Node 22 έχει fs.globSync, αλλά κρατάμε συμβατότητα με readdirSync.
const globSync = (pattern) => {
  const dir = path.dirname(pattern), base = path.basename(pattern);
  const rx = new RegExp(`^${base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  try { return readdirSync(path.join(root, dir)).filter(f => rx.test(f)).map(f => `${dir}/${f}`); } catch { return []; }
};
const DAY_MS = 86_400_000;
const today = new Date();
const todayKey = today.toISOString().slice(0, 10);
const ageDays = (iso) => (iso ? Math.max(0, Math.round((today.getTime() - Date.parse(iso)) / DAY_MS)) : null);
const pct = (x) => (typeof x === 'number' ? Number((x * 100).toFixed(1)) : null);

const RED = { severeFalseCalm: 0.10, falseAlarm: 0.12, shoreFalseCalm: 0.03, onSitePerWeekMin: 1, driftPct: 10, maxAgeDays: 30 };

// 1 + 2 — άνεμος απέναντι στα ανεμόμετρα
const stationsFile = path.join(root, 'reports/weather/station-truth-latest.json');
const st = readJson(stationsFile);
const row1 = st ? {
  key: 'severeFalseCalmWind', label: 'Βαριά ψεύτικη ηρεμία ανέμου',
  what: 'μπλε πινέζα εκεί που το ανεμόμετρο δίνει πορτοκαλί/κόκκινο, 06-16 UTC, 3 επίπεδα έκθεσης',
  value: pct(st.severeFalseCalm.share), count: st.severeFalseCalm.count, n: st.severeFalseCalm.slots,
  window: `${st.window.from}→${st.window.to}`, stations: st.stations, measuredAt: st.generatedAt, source: rel(stationsFile),
  redLine: `>${RED.severeFalseCalm * 100}%`, breached: st.severeFalseCalm.share > RED.severeFalseCalm,
} : { key: 'severeFalseCalmWind', label: 'Βαριά ψεύτικη ηρεμία ανέμου', value: null, note: 'ο φύλακας σταθμών δεν έχει γράψει αρχείο — τρέξε node scripts/validateColourAgainstStations.mjs', breached: null };
const row2 = st ? {
  key: 'falseAlarmWind', label: 'Ψεύτικος συναγερμός ανέμου',
  what: 'πορτοκαλί/κόκκινη πινέζα εκεί που το ανεμόμετρο δίνει μπλε, ίδιες ώρες και επίπεδα',
  value: pct(st.falseAlarm.share), count: st.falseAlarm.count, n: st.falseAlarm.slots,
  window: `${st.window.from}→${st.window.to}`, stations: st.stations, measuredAt: st.generatedAt, source: rel(stationsFile),
  redLine: `>${RED.falseAlarm * 100}%`, breached: st.falseAlarm.share > RED.falseAlarm,
} : { key: 'falseAlarmWind', label: 'Ψεύτικος συναγερμός ανέμου', value: null, note: 'ίδιο αρχείο με το 1', breached: null };

// 3 — η άμμος, από τον δορυφόρο
const s2File = path.join(root, 'reports/wave-model/shore-surf-national.json');
const s2 = readJson(s2File);
const calmSurf = s2?.instrument?.saysCalmSurf;
const calmBase = s2?.instrument?.calmSurf;
const row3 = Array.isArray(calmSurf) ? {
  key: 'shoreFalseCalm', label: 'Ψεύτικη ηρεμία στην άμμο',
  what: 'μέρες που τυπώνουμε ≤0,3 μ. και ο Sentinel-2 βλέπει αφρό στη λωρίδα 20-30 μ. (με έλεγχο SWIR στους υποψήφιους)',
  value: pct(calmSurf[0] / calmSurf[1]), count: calmSurf[0], n: calmSurf[1],
  baseline: Array.isArray(calmBase) ? `εντελώς ήρεμες μέρες: ${pct(calmBase[0] / calmBase[1])}% (${calmBase[0]}/${calmBase[1]})` : undefined,
  measuredAt: s2.generatedFrom, source: rel(s2File),
  redLine: `>${RED.shoreFalseCalm * 100}%`, breached: calmSurf[0] / calmSurf[1] > RED.shoreFalseCalm,
} : { key: 'shoreFalseCalm', label: 'Ψεύτικη ηρεμία στην άμμο', value: null, note: 'λείπει reports/wave-model/shore-surf-national.json', breached: null };

// 4 — άνθρωποι στην άμμο
const fbDir = path.join(root, 'reports/feedback');
const fbFiles = existsSync(fbDir) ? readdirSync(fbDir).filter(f => /^calibration-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
const fbFile = fbFiles.length ? path.join(fbDir, fbFiles.at(-1)) : null;
const fb = fbFile ? readJson(fbFile) : null;
let row4;
if (fb?.counts?.feedback && fb.window?.first && fb.window?.last) {
  const weeks = Math.max(1, (Date.parse(fb.window.last) - Date.parse(fb.window.first)) / (7 * DAY_MS));
  const byTiming = fb.counts.liveByTiming || {};
  const onSite = Object.entries(byTiming).filter(([k]) => k.endsWith('|now') || k.startsWith('true|')).reduce((s, [, v]) => s + v, 0);
  row4 = {
    key: 'onSiteFeedbackPerWeek', label: 'Σχόλια από την άμμο ανά εβδομάδα',
    what: 'εγγραφές f/ που δηλώνουν «τώρα είμαι εδώ» (ή live:true) — ο μόνος κριτής της ετυμηγορίας',
    value: Number((onSite / weeks).toFixed(2)), count: onSite, n: fb.counts.feedback, weeks: Number(weeks.toFixed(1)),
    negativeShare: fb.negative?.shareOfAll ?? null, window: `${fb.window.first}→${fb.window.last}`,
    measuredAt: fb.generatedAt, source: rel(fbFile),
    redLine: `<${RED.onSitePerWeekMin}/εβδ`, breached: onSite / weeks < RED.onSitePerWeekMin,
  };
} else {
  row4 = { key: 'onSiteFeedbackPerWeek', label: 'Σχόλια από την άμμο ανά εβδομάδα', value: null, note: 'τρέξε scripts/exportFeedbackFromBlobs.mjs και φτιάξε reports/feedback/calibration-<μέρα>.json', breached: null };
}

// 5 — η μετατόπιση που κανείς δεν άθροισε (§ΑΞ1/Α7) — ΜΕΤΡΗΘΗΚΕ ΠΡΩΤΗ ΦΟΡΑ 14/09/2026
// `scripts/measureConservatismDrift.mjs`: ο ΙΔΙΟΣ καιρός (ηχογραφημένος ανά σημείο) και τα ΙΔΙΑ δεδομένα
// περνούν από τον κώδικα της 05/08 (commit 23828152, worktree με junction στο σημερινό public/data) και από
// τον σημερινό, και συγκρίνεται η ετυμηγορία κολύμβησης ανά παραλία-μέρα. Θετικό = γίναμε αυστηρότεροι.
const driftFile = [...globSync('reports/quality/conservatism-drift-*.json')].sort().pop() ?? null;
const drift = driftFile ? readJson(path.join(root, driftFile)) : null;
const row5 = drift ? {
  key: 'conservatismDrift', label: 'Μετατόπιση συντηρητισμού από το κλείδωμα (05/08)',
  what: '% παραλιών-ημερών που η σημερινή ετυμηγορία είναι αυστηρότερη από του κώδικα της 05/08, με ΙΔΙΟ καιρό και ΙΔΙΑ δεδομένα (καθαρή = αυστηρότερα − ηπιότερα)',
  value: drift.netDriftPct, stricterPct: drift.stricterPct, milderPct: drift.milderPct,
  n: drift.comparedBeachDays, meanScoreDeltaPoints: drift.meanScoreDeltaPoints,
  measuredAt: drift.generatedAt, source: driftFile,
  note: drift.netDriftPct <= 0
    ? `η μετατόπιση είναι προς το ΗΠΙΟΤΕΡΟ (${drift.milderPct}% ηπιότερα έναντι ${drift.stricterPct}% αυστηρότερα) — το όριο φυλάει την άλλη κατεύθυνση`
    : `${drift.stricterPct}% αυστηρότερα έναντι ${drift.milderPct}% ηπιότερα`,
  redLine: `>${RED.driftPct}%/μήνα`, breached: drift.netDriftPct > RED.driftPct,
} : {
  key: 'conservatismDrift', label: 'Μετατόπιση συντηρητισμού από το κλείδωμα (05/08)',
  what: '% παραλιών-ημερών που η σημερινή ετυμηγορία είναι αυστηρότερη από του κώδικα της 05/08',
  value: null, note: 'τρέξε scripts/measureConservatismDrift.mjs (record → replay → compare)',
  redLine: `>${RED.driftPct}%/μήνα`, breached: null,
};
// 6 — πόσο παλιά είναι η πιο παλιά εξωτερική μέτρηση
const buoyFile = path.join(root, 'reports/wave-model/buoy-comparison.json');
const buoy = readJson(buoyFile);
const ages = [
  { judge: 'ανεμόμετρα (METAR)', at: st?.generatedAt ?? null, source: st ? rel(stationsFile) : null },
  { judge: 'δορυφόρος στην άμμο (Sentinel-2)', at: s2?.generatedFrom ?? null, source: s2 ? rel(s2File) : null },
  { judge: 'σημαδούρες ΕΛΚΕΘΕ', at: buoy?.generatedAt ?? null, source: buoy ? rel(buoyFile) : null },
  { judge: 'σχόλια επισκεπτών', at: fb?.generatedAt ?? null, source: fb ? rel(fbFile) : null },
].map(a => ({ ...a, days: ageDays(a.at) }));
const oldest = ages.reduce((m, a) => (a.days === null ? m : (m === null || a.days > m.days ? a : m)), null);
const row6 = {
  key: 'daysSinceExternalCheck', label: 'Μέρες από την πιο παλιά εξωτερική μέτρηση',
  what: 'η μεγαλύτερη ηλικία ανάμεσα σε ανεμόμετρα, δορυφόρο, σημαδούρες, σχόλια',
  value: oldest?.days ?? null, oldest: oldest?.judge ?? null, byJudge: ages,
  redLine: `>${RED.maxAgeDays} μέρες`, breached: oldest ? oldest.days > RED.maxAgeDays : null,
};

const rows = [row1, row2, row3, row4, row5, row6];
const entry = { date: todayKey, generatedAt: today.toISOString(), rows, breached: rows.filter(r => r.breached === true).map(r => r.key) };

// append-only ιστορικό, ίδια μέρα = αντικατάσταση
const histFile = path.join(root, 'reports/quality/honesty-scorecard.json');
const hist = readJson(histFile) || [];
const kept = hist.filter(h => h.date !== todayKey);
kept.push(entry);
mkdirSync(path.dirname(histFile), { recursive: true });
writeFileSync(histFile, JSON.stringify(kept, null, 2));

// το παραγόμενο για το Telegram — μόνο η τελευταία γραμμή, χωρίς byJudge/λεπτομέρειες που δεν χωράνε σε κινητό
const genFile = path.join(root, 'netlify/functions/lib/honestyScorecard.generated.mjs');
const compact = rows.map(r => ({ key: r.key, label: r.label, value: r.value, count: r.count ?? null, n: r.n ?? null, unit: r.key === 'onSiteFeedbackPerWeek' ? '/εβδ' : r.key === 'daysSinceExternalCheck' ? ' μέρες' : '%', redLine: r.redLine ?? null, breached: r.breached, note: r.note ?? null, oldest: r.oldest ?? null, window: r.window ?? null }));
writeFileSync(genFile, `// ΠΑΡΑΓΟΜΕΝΟ ΑΡΧΕΙΟ — μην το πειράξεις με το χέρι. Φτιάχνεται με: node scripts/buildHonestyScorecard.mjs
// Το διαβάζει το εβδομαδιαίο μήνυμα quality-digest. Ιστορικό: reports/quality/honesty-scorecard.json
export const generatedAt = ${JSON.stringify(todayKey)};
export const rows = ${JSON.stringify(compact)};
export const breached = ${JSON.stringify(entry.breached)};
export default { generatedAt, rows, breached };
`);

console.log(`=== ΤΑΜΠΛΟ ΕΙΛΙΚΡΙΝΕΙΑΣ ${todayKey} ===`);
for (const r of rows) {
  const v = r.value === null ? '—' : `${r.value}${r.key === 'onSiteFeedbackPerWeek' ? '/εβδ' : r.key === 'daysSinceExternalCheck' ? ' μέρες' : '%'}`;
  const nn = typeof r.count === 'number' && typeof r.n === 'number' ? ` (${r.count}/${r.n})` : '';
  const flag = r.breached === true ? ' 🔴' : r.breached === false ? ' ✅' : ' ❓';
  console.log(`${flag} ${r.label}: ${v}${nn}${r.window ? ` · ${r.window}` : ''}${r.oldest ? ` · ${r.oldest}` : ''}${r.note ? ` · ${r.note}` : ''} · όριο ${r.redLine ?? '—'}`);
}
console.log(`\n→ ${rel(histFile)} (${kept.length} γραμμές)\n→ ${rel(genFile)}`);
