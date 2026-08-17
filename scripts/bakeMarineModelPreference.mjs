/**
 * ΠΟΙΕΣ ΠΑΡΑΛΙΕΣ ΠΡΕΠΕΙ ΝΑ ΡΩΤΑΝΕ ΤΟ ΔΕΥΤΕΡΟ ΜΟΝΤΕΛΟ ΚΥΜΑΤΟΣ, ΚΑΙ ΓΙΑΤΙ.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. 255 από 2.872 παραλίες παίρνουν ύψος κύματος από κελί που περιγράφει νερό το
 * οποίο δεν βλέπουν (`auditMarineCellTrust.mjs`). Ρωτάμε ήδη δύο μοντέλα και κρατάμε «όποιο
 * απαντήσει πρώτο» — ewam, μετά meteofrance_wave (`utils/marineForecastParsing.ts`). Κανείς δεν
 * ρώτησε ποτέ αν το δεύτερο κοιτάζει ΚΑΛΥΤΕΡΗ θάλασσα. Για 68 από τις 255, κοιτάζει.
 *
 * ΓΙΑΤΙ ΔΕΝ ΑΛΛΑΖΟΥΝ ΚΑΙ ΟΙ 68. Το `marineForecastParsing` τεκμηριώνει μετρημένα ότι το
 * meteofrance_wave (0,0833°) ΔΕΝ ξεχωρίζει τις δύο πλευρές ενός ελληνικού νησιού: σε 290 από 496
 * περιπτώσεις μελτεμιού έδωσε ταυτόσημο ύψος σε βόρεια και νότια ακτή, ενώ το ewam έδωσε διαφορά
 * 1,11 μ. με σωστό πρόσημο 496/496. Άρα «το κελί περνάει τον έλεγχο θέσης» ΔΕΝ σημαίνει «το
 * μοντέλο βλέπει αυτή την ακτή» — ο έλεγχος εμπιστοσύνης μετράει ΘΕΣΗ κελιού, όχι ΙΚΑΝΟΤΗΤΑ.
 *
 * Ο ΔΙΑΧΩΡΙΣΜΟΣ ΠΟΥ ΓΙΝΕΤΑΙ ΕΔΩ. Για κάθε υποψήφια κοιτάμε ποιες ΑΛΛΕΣ παραλίες της χώρας
 * πέφτουν στο ΙΔΙΟ κελί, σε κάθε μοντέλο, και πόσο διαφέρει ο προσανατολισμός τους:
 *
 *   • ΑΣΦΑΛΗΣ        — το κελί του meteofrance δεν φιλοξενεί ακτή που κοιτάζει ≥120° αλλού.
 *   • ΙΔΙΑ ΖΗΜΙΑ     — μουτζουρώνουν και τα δύο μοντέλα εκεί· η αλλαγή δεν χάνει διάκριση που
 *                      υπήρχε, και κερδίζει κελί που η παραλία όντως βλέπει.
 *   • ΟΠΙΣΘΟΔΡΟΜΗΣΗ  — το ewam ξεχωρίζει τις δύο ακτές και το meteofrance όχι. ΔΕΝ ΑΛΛΑΖΕΙ.
 *
 * ΤΟ ΚΟΣΤΟΣ ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ (`measureAlternateMarineModel.mjs`, 5.576 ώρες×παραλία, δωρεάν πλάνο):
 * το κύμα ανεβαίνει ορατά σε 12,9% των ωρών και πέφτει ορατά σε 0,9% — δηλαδή η αλλαγή δείχνει
 * τις παραλίες πιο ΑΓΡΙΕΣ 14 φορές συχνότερα απ' ό,τι πιο ήρεμες, που είναι η ασφαλής μεριά
 * κατά τη σκανδάλη #1 της §9.
 *
 * ΓΙΑΤΙ ΚΛΕΙΔΙ ΤΟ ΣΗΜΕΙΟ ΚΑΙ ΟΧΙ Η ΠΑΡΑΛΙΑ. Η πρόγνωση ζητείται ανά ΣΗΜΕΙΟ, πριν υπάρχει
 * παραλία στο νήμα. Επαληθεύτηκε ότι και οι 55 έχουν ΔΙΚΟ τους σημείο δειγματοληψίας — καμία δεν
 * το μοιράζεται με παραλία που δεν πρέπει να αλλάξει — άρα το κλειδί σημείου είναι ισοδύναμο με
 * κλειδί παραλίας εδώ, χωρίς να χρειαστεί να ταξιδέψει η ταυτότητα της παραλίας ως το δίκτυο.
 *
 * Τρέξιμο:  node scripts/bakeMarineModelPreference.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODELS, cacheKey, distanceKm, bearingDeg, interpolatedFetchKm,
  MIN_FETCH_RATIO, MAX_TRUSTED_DISTANCE_KM,
} from './lib/marineCellTrust.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const outPath = path.join(root, 'utils/marineModelPreference.generated.ts');

/** Πόσο πρέπει να διαφέρει ο προσανατολισμός για να μιλάμε για «αντίθετη ακτή». */
const OPPOSITE_COAST_DEG = 120;

const cache = JSON.parse(readFileSync(path.join(root, '.tmp/marine-cell-snap-cache-v2.json'), 'utf8'));
const ledger = JSON.parse(readFileSync(path.join(root, 'reports/quality/marine-cell-trust-per-beach.json'), 'utf8'));

const profiles = new Map();
const regionPoint = new Map();
for (const file of readdirSync(exposureDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  const payload = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8'));
  for (const p of Object.values(payload.profiles ?? {})) if (p?.beachId != null) profiles.set(p.beachId, p);
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    for (const b of app.island.beaches) regionPoint.set(b.id, app.island.coordinates);
  } catch { /* περιοχή χωρίς app αρχείο */ }
}

const judgeModel = (profile, point, model) => {
  const served = cache[cacheKey(model.id, model.gridDeg, point.lat, point.lon)];
  if (!served || !(served.values > 0)) return null;
  const { lat, lon } = profile.coordinates;
  const d = distanceKm(lat, lon, served.lat, served.lon);
  if (d < 0.5) return { trusted: true, distanceKm: d };
  const brg = bearingDeg(lat, lon, served.lat, served.lon);
  const fetchKm = interpolatedFetchKm(profile.sectors, brg);
  if (fetchKm === null) return null;
  if (d > MAX_TRUSTED_DISTANCE_KM) return { trusted: false, distanceKm: d };
  return { trusted: fetchKm >= MIN_FETCH_RATIO * d, distanceKm: d };
};

// Ποιες παραλίες μοιράζονται κελί, ανά μοντέλο — ο έλεγχος «μουτζούρας».
const gapDeg = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const cellMembers = new Map(); // `${modelId}|${cellKey}` -> [facingDeg]
for (const p of profiles.values()) {
  if (!p.coordinates || typeof p.facingDeg !== 'number') continue;
  for (const m of MODELS) {
    const k = `${m.id}|${cacheKey(m.id, m.gridDeg, p.coordinates.lat, p.coordinates.lon)}`;
    if (!cellMembers.has(k)) cellMembers.set(k, []);
    cellMembers.get(k).push({ id: p.beachId, facing: p.facingDeg });
  }
}
const worstGapIn = (profile, model) => {
  const k = `${model.id}|${cacheKey(model.id, model.gridDeg, profile.coordinates.lat, profile.coordinates.lon)}`;
  return (cellMembers.get(k) ?? [])
    .filter(m => m.id !== profile.beachId)
    .reduce((max, m) => Math.max(max, gapDeg(profile.facingDeg, m.facing)), 0);
};

const pointKey = (p) => `${p.lat.toFixed(3)}_${p.lon.toFixed(3)}`;
const entries = [];
const skippedRegression = [];

// ΠΟΣΕΣ ΠΑΡΑΛΙΕΣ ΡΩΤΑΝΕ ΤΟ ΚΑΘΕ ΣΗΜΕΙΟ. Το κλειδί της προτίμησης είναι ΣΗΜΕΙΟ, όχι παραλία, άρα
// αλλάζοντας το μοντέλο σε ένα κοινόχρηστο σημείο αλλάζει και για όποιον άλλον το μοιράζεται —
// συμπεριλαμβανομένων παραλιών που διαβάζουν μια χαρά. Το typecheck το έπιασε ως διπλό κλειδί.
const usersOfPoint = new Map();
for (const p of profiles.values()) {
  const sp = p.marineSamplePoint ?? regionPoint.get(p.beachId);
  if (!sp) continue;
  const k = `${sp.lat.toFixed(3)}_${sp.lon.toFixed(3)}`;
  usersOfPoint.set(k, (usersOfPoint.get(k) ?? 0) + 1);
}

const skippedShared = [];

for (const item of ledger.filter(b => !b.trusted)) {
  const profile = profiles.get(item.beachId);
  // ΜΟΝΟ δικό της σημείο. Όσες πέφτουν στο κοινό σημείο της περιοχής αποκλείονται εξ ορισμού:
  // εκεί η προτίμηση θα μιλούσε για δεκάδες παραλίες μαζί, που είναι ακριβώς το είδος της
  // «μιας αλλαγής που αγγίζει αθώους» που αυτή η δουλειά προσπαθεί να σταματήσει.
  const point = profile?.marineSamplePoint;
  if (!profile || !point || typeof profile.facingDeg !== 'number') continue;
  if ((usersOfPoint.get(`${point.lat.toFixed(3)}_${point.lon.toFixed(3)}`) ?? 1) > 1) {
    skippedShared.push({ beachId: item.beachId, name: item.name });
    continue;
  }

  const verdicts = MODELS.map(m => ({ model: m, ...(judgeModel(profile, point, m) ?? { trusted: false }) }));
  const winner = verdicts.find(v => v.trusted);
  if (!winner || winner.model.id === item.model) continue;

  const mfGap = worstGapIn(profile, winner.model);
  const currentModel = MODELS.find(m => m.id === item.model) ?? MODELS[0];
  const currentGap = worstGapIn(profile, currentModel);

  if (mfGap >= OPPOSITE_COAST_DEG && currentGap < OPPOSITE_COAST_DEG) {
    skippedRegression.push({ beachId: item.beachId, name: item.name, mfGap: Math.round(mfGap) });
    continue;
  }
  entries.push({
    key: pointKey(point), model: winner.model.id, beachId: item.beachId, name: item.name,
    region: item.region, reason: mfGap >= OPPOSITE_COAST_DEG ? 'both-smeared' : 'safe',
  });
}

entries.sort((a, b) => a.beachId - b.beachId);
const body = entries.map(e =>
  `  '${e.key}': '${e.model}', // #${e.beachId} ${e.name} (${e.region}) — ${e.reason}`
).join('\n');

const file = `/**
 * ΠΑΡΑΓΟΜΕΝΟ ΑΡΧΕΙΟ — μην το γράψεις με το χέρι.
 * Φτιάχνεται από: node scripts/bakeMarineModelPreference.mjs
 *
 * Ποια σημεία πρόγνωσης πρέπει να διαβάζονται από ΑΛΛΟ μοντέλο κύματος από το προεπιλεγμένο.
 * Το «γιατί» ζει ολόκληρο στον παραγωγό και στο utils/marineForecastParsing. Σε δύο γραμμές:
 * το ewam κερδίζει παντού επειδή μετρήθηκε καλύτερο σε 9.723 ώρες σημαδούρας, ΑΛΛΑ σε ${entries.length}
 * σημεία το κελί του περιγράφει νερό που η παραλία δεν βλέπει ενώ του meteofrance_wave όχι.
 * Οι ${skippedRegression.length} περιπτώσεις όπου το meteofrance θα έχανε τη διάκριση των δύο ακτών ΔΕΝ μπαίνουν εδώ.
 */
export type MarineModelId = 'ewam' | 'meteofrance_wave';

/** Κλειδί: \`\${lat.toFixed(3)}_\${lon.toFixed(3)}\` του σημείου που ζητείται από το Open-Meteo. */
export const MARINE_MODEL_PREFERENCE: Readonly<Record<string, MarineModelId>> = Object.freeze({
${body}
});

/** Πόσα σημεία απέκλεισε ο έλεγχος «μουτζούρας» — για την πύλη, ώστε να μη σβήσει σιωπηλά. */
export const MARINE_MODEL_PREFERENCE_SKIPPED = ${skippedRegression.length};
`;

writeFileSync(outPath, file, 'utf8');
console.log(`γράφτηκαν ${entries.length} σημεία → ${path.relative(root, outPath)}`);
console.log(`  ασφαλή: ${entries.filter(e => e.reason === 'safe').length} · ίδια ζημιά: ${entries.filter(e => e.reason === 'both-smeared').length}`);
console.log(`  ΔΕΝ μπήκαν (οπισθοδρόμηση): ${skippedRegression.length} — ${skippedRegression.map(s => s.name).join(', ')}`);
console.log(`  ΔΕΝ μπήκαν (κοινόχρηστο σημείο): ${skippedShared.length}`);

// Το κλειδί ΠΡΕΠΕΙ να είναι μοναδικό, αλλιώς το αρχείο δεν μεταγλωττίζεται καν — και ένα διπλό
// κλειδί θα σήμαινε ότι μια παραλία αποφασίζει για μια άλλη.
const seen = new Set();
for (const e of entries) {
  if (seen.has(e.key)) { console.error(`ΔΙΠΛΟ ΚΛΕΙΔΙ: ${e.key} (#${e.beachId})`); process.exit(1); }
  seen.add(e.key);
}
