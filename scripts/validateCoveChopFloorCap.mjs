#!/usr/bin/env node
/**
 * ΤΟ ΔΑΠΕΔΟ ΨΙΛΟΚΥΜΑΤΟΣ ΣΤΟΥΣ ΟΡΜΟΥΣ: ΚΟΒΕΤΑΙ, ΔΕΝ ΣΒΗΝΕΙ, ΚΑΙ ΤΟ FETCH ΦΤΑΝΕΙ ΩΣ ΕΚΕΙ (14/09/2026, βίβλος §Γ81 Δ6-Γ).
 *
 * ΤΙ ΦΥΛΑΕΙ. Από 14/09 το δάπεδο ψιλοκύματος (0,80 μ. σε κάθε εκτεθειμένη ακτή στα 5 Μποφόρ) δεν ξεπερνά, κάτω από
 * COVE_FETCH_KM νερό στη ζωντανή διεύθυνση, το SMB που θα έχτιζε η ριπή πάνω σε αυτό το fetch — ποτέ όμως κάτω από το
 * δάπεδο της «προστατευμένης» (utils/waveModel.capWindChopFloorByFetchM). Ο κριτής: Sentinel-2, 5 καλοκαίρια, 252 καθαρές
 * μέρες — αφρός θραύσης 2,0% όπου τυπώναμε 0,8 (ήρεμη 0,9%, πραγματικό κύμα 23%). Η αλλαγή έχει ΔΥΟ μισά που σπάνε
 * ανεξάρτητα και αόρατα: τη συνάρτηση, και το ΠΕΡΑΣΜΑ του fetch από τους καλούντες του resolveDisplayWaveHeightM. Αν
 * κάποιος σβήσει το `windSectorFetchKm` από έναν καλούντα, το δάπεδο ξαναγίνεται 0,80 σε κάθε όρμο και ΚΑΜΙΑ άλλη πύλη δεν
 * το βλέπει (όλες μετρούν με ή χωρίς fetch το ίδιο).
 *
 *   Α. Η ΣΥΝΑΡΤΗΣΗ: σε όρμο < 3 χλμ το δάπεδο πέφτει (εκτεθειμένη 5 Μπφ 32/45: 0,90 → 0,45) και ΠΟΤΕ κάτω από την
 *      «προστατευμένη»· ≥ 3 χλμ, χωρίς fetch, ή protected: ΤΙΠΟΤΑ δεν αλλάζει· ποτέ πάνω από το αρχικό δάπεδο (μονόδρομη).
 *   Β. Η ΑΛΥΣΙΔΑ: ο resolveDisplayWaveHeightM με fetch 0,5 χλμ τυπώνει λιγότερο απ' ό,τι χωρίς fetch, στο ίδιο νερό.
 *   Γ. ΟΙ ΚΑΛΟΥΝΤΕΣ: κάθε κλήση του resolveDisplayWaveHeightM στο services/recommendationService.ts περνά
 *      `windSectorFetchKm: windAssessment.effectiveFetchKm` (σήμερα 2 — η ωριαία λωρίδα και η ημερήσια κεφαλίδα).
 *   Δ. ΑΥΤΟΣΑΜΠΟΤΑΖ: ο έλεγχος Γ πάνω σε κείμενο χωρίς το πέρασμα ΠΡΕΠΕΙ να πέφτει.
 *
 *   node scripts/validateCoveChopFloorCap.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
const wave = require(path.join(root, 'utils/waveModel.ts'));
const { getWindChopWaveFloorM, capWindChopFloorByFetchM, resolveDisplayWaveHeightM, COVE_FETCH_KM } = wave;

const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
const near = (a, b) => Math.abs(a - b) < 0.006;

// ── Α. η συνάρτηση ──────────────────────────────────────────────────────────────────────────────
const base = { beaufort: 5, windSpeedKmh: 32, gustKmph: 45 };
const rawExposed = getWindChopWaveFloorM('exposed', base.beaufort, base.windSpeedKmh, base.gustKmph);
const protectedFloor = getWindChopWaveFloorM('protected', base.beaufort, base.windSpeedKmh, base.gustKmph);
const inCove = capWindChopFloorByFetchM(rawExposed, { exposureLevel: 'exposed', ...base, fetchKm: 0.5 });
check(COVE_FETCH_KM === 3, `Α. το όριο του όρμου είναι 3 χλμ (COVE_FETCH_KM=${COVE_FETCH_KM}) — η κλάση που έκρινε ο δορυφόρος`);
check(inCove < rawExposed - 0.2, `Α. εκτεθειμένη 5 Μπφ 32/45 σε 0,5 χλμ: δάπεδο ${rawExposed} → ${inCove} (πέφτει)`);
check(near(inCove, protectedFloor) || inCove > protectedFloor, `Α. ποτέ κάτω από την «προστατευμένη» ${protectedFloor}: ${inCove}`);
const grid = [];
for (const exposureLevel of ['exposed', 'partial']) for (const beaufort of [4, 5, 6, 7]) for (const [w, g] of [[24, 34], [32, 45], [42, 58], [55, 75]]) for (const fetchKm of [0, 0.3, 1, 1.9, 2.9]) {
  const raw = getWindChopWaveFloorM(exposureLevel, beaufort, w, g);
  const prot = getWindChopWaveFloorM('protected', beaufort, w, g);
  const capped = capWindChopFloorByFetchM(raw, { exposureLevel, beaufort, windSpeedKmh: w, gustKmph: g, fetchKm });
  grid.push({ ok: capped <= raw + 0.001 && capped >= prot - 0.006, exposureLevel, beaufort, w, g, fetchKm, raw, prot, capped });
}
const bad = grid.filter(c => !c.ok);
check(!bad.length, `Α. ${grid.length} συνδυασμοί όρμου: πάντα ≤ αρχικό δάπεδο και ≥ «προστατευμένη»${bad.length ? ` — ${JSON.stringify(bad[0])}` : ''}`);
const untouched = [
  ['≥ 3 χλμ', capWindChopFloorByFetchM(rawExposed, { exposureLevel: 'exposed', ...base, fetchKm: 3 })],
  ['10 χλμ', capWindChopFloorByFetchM(rawExposed, { exposureLevel: 'exposed', ...base, fetchKm: 10 })],
  ['χωρίς fetch', capWindChopFloorByFetchM(rawExposed, { exposureLevel: 'exposed', ...base })],
  ['NaN fetch', capWindChopFloorByFetchM(rawExposed, { exposureLevel: 'exposed', ...base, fetchKm: Number.NaN })],
];
for (const [label, v] of untouched) check(near(v, rawExposed), `Α. ${label}: αμετάβλητο (${v} = ${rawExposed})`);
check(near(capWindChopFloorByFetchM(protectedFloor, { exposureLevel: 'protected', ...base, fetchKm: 0.5 }), protectedFloor), `Α. protected σε όρμο: αμετάβλητο (${protectedFloor})`);
check(capWindChopFloorByFetchM(0, { exposureLevel: 'exposed', ...base, fetchKm: 0.5 }) === 0, 'Α. δάπεδο 0 μένει 0 (2 Μποφόρ)');

// ── Β. η αλυσίδα μέσα από τον resolver ─────────────────────────────────────────────────────────
const resolverInput = { exposureLevel: 'exposed', modeledWaveHeightM: 0.2, beaufort: 5, windSpeedKmh: 32, gustKmph: 45, measuredWaveHeightM: 0.15 };
const withFetch = resolveDisplayWaveHeightM({ ...resolverInput, windSectorFetchKm: 0.5 }).effectiveWaveHeightM;
const withoutFetch = resolveDisplayWaveHeightM(resolverInput).effectiveWaveHeightM;
const openFetch = resolveDisplayWaveHeightM({ ...resolverInput, windSectorFetchKm: 12 }).effectiveWaveHeightM;
check(withFetch < withoutFetch - 0.2, `Β. resolver: όρμος 0,5 χλμ ${withFetch} < χωρίς fetch ${withoutFetch}`);
check(near(openFetch, withoutFetch), `Β. resolver: 12 χλμ ${openFetch} = χωρίς fetch ${withoutFetch}`);
check(withFetch >= protectedFloor - 0.006, `Β. resolver: ο όρμος δεν πέφτει κάτω από την «προστατευμένη» ${protectedFloor} (${withFetch})`);

// ── Γ. οι καλούντες περνούν το fetch ────────────────────────────────────────────────────────────
const svcPath = path.join(root, 'services/recommendationService.ts');
const svc = readFileSync(svcPath, 'utf8');
const callersPassFetch = (source) => {
  const calls = [...source.matchAll(/resolveDisplayWaveHeightM\(\{/g)];
  const missing = [];
  for (const m of calls) {
    const block = source.slice(m.index, source.indexOf('});', m.index) + 3);
    if (!/windSectorFetchKm:\s*windAssessment\.effectiveFetchKm/.test(block)) missing.push(source.slice(0, m.index).split('\n').length);
  }
  return { calls: calls.length, missing };
};
const live = callersPassFetch(svc);
check(live.calls >= 2 && !live.missing.length, `Γ. recommendationService: ${live.calls} κλήσεις του resolver, όλες περνούν windSectorFetchKm${live.missing.length ? ` — λείπει στις γραμμές ${live.missing.join(', ')}` : ''}`);

// ── Δ. αυτοσαμποτάζ ─────────────────────────────────────────────────────────────────────────────
const sabotaged = callersPassFetch(svc.replace(/\n\s*windSectorFetchKm:\s*windAssessment\.effectiveFetchKm,/, '\n'));
check(sabotaged.missing.length === 1, `Δ. αυτοσαμποτάζ: με το πέρασμα σβησμένο από έναν καλούντα ο έλεγχος Γ πέφτει (${sabotaged.missing.length} λείπει)`);

console.log(failures.length ? `\nΕΠΕΣΕ: ${failures.length} έλεγχοι` : '\nΠΕΡΑΣΕ: το δάπεδο κόβεται μόνο στους όρμους, ποτέ κάτω από την «προστατευμένη», και το fetch φτάνει από κάθε καλούντα.');
process.exit(failures.length ? 1 : 0);
