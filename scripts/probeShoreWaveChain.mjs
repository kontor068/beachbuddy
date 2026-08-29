#!/usr/bin/env node
/**
 * ΤΙ ΑΚΡΙΒΩΣ ΚΑΝΕΙ ΤΟΝ ΑΡΙΘΜΟ ΤΗΣ ΑΚΤΗΣ, ΒΗΜΑ ΒΗΜΑ — εργαλείο τριάζ για αναφορές χρηστών.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Στις 29/08/2026 ο Μίλτος έστειλε τέσσερις αναφορές από webcam μέσα σε μία
 * ώρα (Βάι #730, Λίνδος #2443, Κιτροπλατεία #746, Αλμυρός #720) — «δεν είναι λάδι», «δεν έχει
 * τόσο κύμα». Κάθε μία χρειάστηκε μισή ώρα χειροκίνητο ξετύλιγμα του ίδιου ακριβώς μονοπατιού.
 * Το μονοπάτι είναι ντετερμινιστικό και οι είσοδοί του είναι τέσσερις αριθμοί, οπότε δεν
 * υπάρχει λόγος να ξετυλίγεται με το χέρι ξανά.
 *
 * ΤΙ ΔΕΝ ΕΙΝΑΙ: δεν είναι πύλη και δεν κρίνει τίποτα. Δεν αποτυγχάνει ποτέ, δεν γράφει αρχεία.
 * Τυπώνει τι θα έβγαζε ο κώδικας που ΤΡΕΧΕΙ, για να μη μαντεύει κανείς.
 *
 * ⚠️ ΚΑΛΕΙ ΤΙΣ ΑΛΗΘΙΝΕΣ ΣΥΝΑΡΤΗΣΕΙΣ, ΔΕΝ ΤΙΣ ΞΑΝΑΓΡΑΦΕΙ. Ο λόγος είναι γραμμένος στο
 * scripts/validateEffectiveRanking.ts:16-18: πύλη αυτού του σπιτιού πέρασε κάποτε πράσινη πάνω
 * σε σκόπιμα σαμποταρισμένο κώδικα, ακριβώς επειδή είχε δική της αντιγραφή της λογικής. Ό,τι
 * εδώ φαίνεται σαν τύπος (K_d, SMB, κατώφλια λέξης) είναι import.
 *
 * ΧΡΗΣΗ:
 *   node scripts/probeShoreWaveChain.mjs 730 --wind=0 --kmh=28 --open=1.1
 *   node scripts/probeShoreWaveChain.mjs 730 746 720 2443 --wind=0 --kmh=28 --open=1.1
 *   node scripts/probeShoreWaveChain.mjs 746 --sweep          (όλες οι διευθύνσεις ανά 30°)
 *
 *   --wind=<μοίρες>  από πού φυσάει (και, χωρίς --wave, από πού έρχεται και το κύμα)
 *   --wave=<μοίρες>  από πού έρχεται το κύμα, όταν διαφέρει από τον άνεμο
 *   --kmh=<χλμ/ώρα>  ταχύτητα ανέμου στην παραλία
 *   --open=<μέτρα>   το ύψος στα ανοιχτά, όπως θα το έδινε το μοντέλο
 *
 * ΟΙ ΕΙΣΟΔΟΙ ΕΙΝΑΙ ΣΕΝΑΡΙΟ, ΟΧΙ ΜΕΤΡΗΣΗ. Το εργαλείο δεν χτυπάει κανένα API — δίνεις εσύ τι
 * έλεγε ο καιρός την ώρα της αναφοράς και σου λέει τι έβγαλε η μηχανή από αυτό.
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
  }).outputText, filename);
};
const req = (rel) => require(path.join(root, rel));

const { resolveSeaArrivalExposureLevel, resolveShoreShadowDamping, SEA_ARRIVAL_GRAZING } = req('utils/seaArrival.ts');
const { shoreSeaStateM } = req('utils/waveCharacter.ts');
const { estimateShoreWaveHeightM } = req('utils/shoreWave.ts');
const { interpolateSectorGeometry } = req('utils/windExposureModel.ts');
const { estimateFetchLimitedWaveHeightM, getWindChopWaveFloorM, printedWaveHeightM } = req('utils/waveModel.ts');
const { buildBeachConditionsReadout } = req('utils/beachConditionsReadout.ts');

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorOf = (deg) => SECTORS[Math.floor((((deg % 360) + 360) % 360 + 22.5) / 45) % 8];

const loadProfiles = () => {
  const dir = path.join(root, 'public/data/geospatial/exposure');
  const byId = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const walk = (node) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== 'object') return;
      if (typeof node.beachId === 'number' && node.sectors) byId.set(node.beachId, node);
      Object.values(node).forEach(walk);
    };
    walk(payload);
  }
  return byId;
};

const loadNames = () => {
  const dir = path.join(root, 'public/data/beaches');
  const byId = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    if (['index.json', 'search-index.json', 'geo-index.json'].includes(file)) continue;
    let payload;
    try { payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch { continue; }
    const walk = (node) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== 'object') return;
      if (typeof node.id === 'number' && node.name && typeof node.lat === 'number') byId.set(node.id, node);
      Object.values(node).forEach(walk);
    };
    walk(payload);
  }
  return byId;
};

/** Ένα πέρασμα του μονοπατιού. Επιστρέφει κάθε ενδιάμεσο, όχι μόνο το αποτέλεσμα. */
const runChain = ({ profile, windDeg, waveDeg, windKmh, openM }) => {
  const sectorName = sectorOf(windDeg);
  const sector = profile.sectors?.[sectorName];
  const level = sector?.level;

  // Το `finalExposureLevel` της παραγωγής περνάει κι από τον windExposureEngine (παρεμβολή,
  // curated όρμοι, windProfile). Εδώ κρατάμε τον αποθηκευμένο τομέα και το ΔΗΛΩΝΟΥΜΕ: ό,τι
  // δείχνει αυτό το εργαλείο για το level είναι η γεωμετρία, όχι η τελική ετυμηγορία.
  const arrival = resolveSeaArrivalExposureLevel(profile, waveDeg);
  const kd = resolveShoreShadowDamping(profile, waveDeg);
  const damped = shoreSeaStateM(openM, level, arrival, false, kd);

  const liveGeometry = interpolateSectorGeometry(profile, windDeg);
  const shoreModelM = estimateShoreWaveHeightM({
    openWaterWaveHeightM: openM,
    windSpeedKmh: windKmh,
    sector: { ...liveGeometry, onshore: Math.cos(((windDeg - profile.facingDeg) * Math.PI) / 180) },
    confidence: profile.confidence,
  });

  const shoreM = typeof shoreModelM === 'number'
    ? Math.min(shoreModelM, damped ?? shoreModelM)
    : damped;

  const readout = buildBeachConditionsReadout({
    beachWindSpeedKmph: windKmh,
    waveHeightM: openM,
    shoreDisplayWaveM: shoreM,
    seaArrivalExposureLevel: arrival,
    language: 'gr',
  });

  return {
    sectorName, sector, level, arrival, kd, damped, shoreModelM, shoreM,
    smbM: estimateFetchLimitedWaveHeightM({ windSpeedKmh: windKmh, fetchKm: liveGeometry.fetchKm }),
    chopFloorM: getWindChopWaveFloorM(level ?? 'partial', Math.round(windKmh / 6.5), windKmh),
    printedM: printedWaveHeightM(shoreM),
    word: readout.waveWord, text: readout.waveText,
  };
};

const args = process.argv.slice(2);
const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const sweep = args.includes('--sweep');

if (ids.length === 0) {
  console.error('Δώσε τουλάχιστον ένα beachId. Π.χ.: node scripts/probeShoreWaveChain.mjs 730 --wind=0 --open=1.1');
  process.exit(1);
}

const profiles = loadProfiles();
const names = loadNames();
const windDeg = flag('wind', 0);
const waveDeg = flag('wave', windDeg);
const windKmh = flag('kmh', 28);
const openM = flag('open', 1.1);

console.log('ΣΕΝΑΡΙΟ (δικό σου, όχι μέτρηση): '
  + `άνεμος ${windDeg}° / ${windKmh} χλμ.ώ · κύμα από ${waveDeg}° · ανοιχτά ${openM} μ.\n`);

for (const id of ids) {
  const profile = profiles.get(id);
  const meta = names.get(id);
  const label = meta?.name ?? `#${id}`;
  if (!profile) { console.log(`#${id} ${label}: δεν έχει γεωμετρικό προφίλ — το μονοπάτι δεν τρέχει.\n`); continue; }

  const maxFetchKm = Math.max(...SECTORS.map((s) => profile.sectors?.[s]?.fetchKm ?? 0));
  console.log(`── #${id} ${label} — κοιτάει ${profile.facingDeg}° · μεγαλύτερο άνοιγμα ${maxFetchKm.toFixed(1)} χλμ · εμπιστοσύνη ${profile.confidence}`);

  const directions = sweep ? Array.from({ length: 12 }, (_, i) => i * 30) : [null];
  for (const dir of directions) {
    const w = dir ?? windDeg;
    const v = dir ?? waveDeg;
    const r = runChain({ profile, windDeg: w, waveDeg: v, windKmh, openM });
    const onshore = Math.cos(((v - profile.facingDeg) * Math.PI) / 180);
    const head = sweep ? `  ${String(w).padStart(3)}°` : '  ';
    console.log(`${head} τομέας ${r.sectorName.padEnd(2)} (${String(r.level).padEnd(9)}, fetch ${(r.sector?.fetchKm ?? 0).toFixed(2).padStart(5)} χλμ)`
      + ` · onshore κύματος ${onshore >= 0 ? '+' : ''}${onshore.toFixed(3)}`
      + ` · άφιξη «${r.arrival === undefined ? 'undefined' : r.arrival}»`
      + ` · K_d ${r.kd === undefined ? ' —  ' : r.kd.toFixed(3)}`
      + ` · έκπτωση→ ${String(r.damped ?? '—').padStart(5)}`
      + ` · ράμπα→ ${String(r.shoreModelM ?? '—').padStart(5)}`
      + ` · ΤΥΠΩΝΕΙ ${r.text ?? '—'} «${r.word ?? '—'}»`);
  }
  console.log('');
}

console.log('Σημείωση: το `level` εδώ είναι ο αποθηκευμένος γεωμετρικός τομέας. Στην παραγωγή περνάει');
console.log('και από τον windExposureEngine (παρεμβολή, curated όρμοι, windProfile), που μπορεί να το αλλάξει.');
