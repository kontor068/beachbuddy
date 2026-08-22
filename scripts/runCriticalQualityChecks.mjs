import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(rootDir, '.tmp', 'critical-quality-report.json');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const args = new Set(process.argv.slice(2));
const maxAttemptsArg = process.argv.find(arg => arg.startsWith('--max-attempts='));
const maxAttempts = Math.max(1, Number(maxAttemptsArg?.split('=')[1] || (args.has('--auto') ? 3 : 1)));

const checks = [
  {
    id: 'beach-data',
    title: 'Critical beach data',
    description: 'Checks generated beach JSON for missing/invalid ids, names, Greece coordinates, duplicate ids, invalid enums, quiet + beach bar conflicts, and verified photo license/attribution gaps.',
    protects: 'Prevents broken beach records and unsafe/unclear beach facts from reaching the app.',
    failureAction: 'Fix the listed beach JSON or photo metadata. Do not invent coordinates, names, wind claims, or image rights.',
    command: process.execPath,
    args: ['scripts/validateCriticalBeachData.mjs'],
  },
  {
    id: 'auth-csp',
    title: 'Accounts ↔ Content-Security-Policy',
    description: 'If accounts are configured, checks that the enforcing CSP in netlify.toml actually allows the Supabase origin this build talks to — and that it is the exact origin, not a wildcard.',
    protects: 'Prevents sign-in, saved beaches and photo uploads from failing silently in production while working perfectly on localhost, where no CSP header exists.',
    failureAction: 'Add the exact Supabase origin to connect-src in netlify.toml. Never use https://*.supabase.co — that allows every Supabase tenant on the internet.',
    command: process.execPath,
    args: ['scripts/validateAuthCsp.mjs'],
  },
  {
    id: 'shoreline-shapes',
    title: 'Shoreline thumbnails',
    description: 'Checks the committed per-beach shoreline drawings still match the beach coordinates and coastline they were built from, and that every drawing is left-to-right with the beach sitting on its own waterline.',
    protects: 'Prevents a corrected pin from leaving behind a confident-looking map of where the beach used to be.',
    failureAction: 'Run: npm run build:shorelines, then commit the regenerated public/data/coastline/shape/*.json.',
    command: process.execPath,
    args: ['scripts/validateShorelineShapes.mjs'],
  },
  {
    id: 'new-beach-completeness',
    title: 'Κάθε νέα παραλία φέρνει μαζί της τη γεωμετρία, το κύμα και την κατεύθυνσή της',
    description: 'Ελέγχει ότι κάθε παραλία με id ≥ 3000 έχει τα τρία που παράγονται μηχανικά από ό,τι ήδη έχουμε: προφίλ έκθεσης, σημείο δειγματοληψίας κύματος (ή τεκμηριωμένη απουσία του σε κλειστό όρμο) και γραμμένη κατεύθυνση ακτής. Πρόσβαση, παροχές, φωτογραφία και βάθος μετριούνται στην αναφορά αλλά δεν μπλοκάρουν — θέλουν πηγή ή ανθρώπινο μάτι.',
    protects: 'Μια νέα παραλία χωρίς γεωμετρία κρίνεται από τον άνεμο της γειτονιάς της και χωρίς σημείο θάλασσας παίρνει το κύμα του κελιού της περιοχής — νερό που συχνά δεν βλέπει. Μετρημένο 17/08/2026: από 185 παραλίες με id ≥ 3000, μόνο ΜΙΑ ήταν πλήρης. Χωρίς πύλη, κάθε νέα παραλία χειροτερεύει σιωπηλά την περιοχή που τη φιλοξενεί.',
    failureAction: 'Τρέξε `node scripts/checkNewBeachCompleteness.mjs` — τυπώνει ανά πεδίο ΠΟΙΑ εντολή το φτιάχνει. ΠΟΤΕ μην περάσεις την πύλη ανεβάζοντας το --since-id: το νούμερο ορίζει ποιες παραλίες είναι «νέες», όχι πόσο αυστηροί είμαστε.',
    command: process.execPath,
    args: ['scripts/checkNewBeachCompleteness.mjs', '--strict', '--required-only'],
  },
  {
    id: 'wind-exposure',
    title: 'Wind exposure engine',
    description: 'Runs wind exposure validation scenarios for shelter, fetch, confidence, and protected/calm label behavior.',
    protects: 'Prevents false calm/protected claims and wrong wind-shelter behavior.',
    failureAction: 'Review windProfile, exposure logic, and scenario expectations before changing user-facing claims.',
    command: process.execPath,
    args: ['scripts/validateWindExposureEngine.mjs'],
  },
  {
    id: 'marine-model-parsing',
    title: 'Marine model/parser contract',
    description: 'Checks the pinned Open-Meteo marine models agree between client and edge proxy, that every requested marine variable is parsed from a model that actually serves it, and that the bare-field fallback survives.',
    protects: 'Prevents a marine field from silently reading undefined — how the water-temperature card vanished from every beach page when a wave-only model was pinned. Nothing throws when this drifts; the data just disappears.',
    failureAction: 'Realign the MARINE_MODEL pins in services/forecast/openMeteoProvider.ts and netlify/functions/forecast.mjs with the series() lookups in services/weatherService.ts. Add --live to re-check which model serves which variable upstream.',
    command: process.execPath,
    args: ['scripts/validateMarineModelParsing.mjs'],
  },
  {
    id: 'recommendation-scenarios',
    title: 'Recommendation scenarios',
    description: 'Runs fixed weather scenarios for Milos, Paros, and Andros, including normal wind, rain, 4 Bft, and 5 Bft rough conditions.',
    protects: 'Prevents exposed or unsafe beaches from becoming top recommendations in hard weather.',
    failureAction: 'Review recommendation scoring, warnings, and no-swimming fallback behavior.',
    command: process.execPath,
    args: ['scripts/validateRecommendationScenarios.mjs'],
  },
  {
    id: 'verdict-consistency',
    title: 'One sea verdict per page',
    description: 'Sweeps 17.820 wind/wave/period/exposure/cove/offshore-wind/score combinations, in the three shapes the badge is really called in (card, detail hero, no-colour fallback), and checks the experience-tier WORD, the "weather now" chip, the wave graphic and the map DOT never describe the same sea two different ways. Then reads the JSX to confirm every <TodayScoreBadge> is actually handed the colour it must obey.',
    protects: 'Prevents the beach page from printing "Excellent today" and "Calm right now" above an orange "Some chop" — three severity ladders that drifted apart on 21% of the grid — and, since 02/08/2026, prevents the verdict word from reading BETTER than the dot beside it. That fourth drift was measured at 169 of 2.376 card combinations (7,1%): «Καλή» over an orange dot on every protected shore at 5-6 Bft, i.e. every card on the home page on a windy day.',
    failureAction: 'Fix the shared ladder in utils/seaVerdict.ts / utils/experienceTier.ts, or pass the colour to the surface that stopped passing it. NEVER re-derive the wind ceiling locally — a second copy of the ladder is what caused both drifts, and it is what this gate exists to prevent.',
    command: process.execPath,
    args: ['scripts/validateVerdictConsistency.mjs'],
  },
  {
    id: 'wave-display-agreement',
    title: 'Displayed wave vs decided sea',
    description: 'Runs every beach with committed geometry against all 8 wind sectors at 5 Bft and checks the metre figure the page prints (BeachScore.waveHeightM) never falls below the sea state it scores on (seaStateWaveM) while the wind blows onto that shore — outside the one validated cove guard.',
    protects: 'Prevents a false calm: "Εκτεθειμένη / Choppy" printed beside a swimmable-looking number. The enclosed-cove display override used to fire in ANY wind, so 545 beach x wind cases showed as little as 0,10 m over a 1,2 m sea — Αγία Θεοδότη (Ίος) read ~0,5 m with the meltemi straight into the bay while sheltered Βάλμας, on the same marine grid cell, read ~1,3 m.',
    failureAction: 'Fix the display override in services/recommendationService.ts. Never widen utils/coveWaveGuard to make a case pass — the guard is certified only for a blocked shore with < 2 km of fetch.',
    command: process.execPath,
    args: ['scripts/validateWaveDisplayAgreement.mjs'],
  },
  {
    id: 'shore-band-jump',
    title: 'The printed metre figure may not claim calm over a sea that is not',
    description: 'Drives utils/beachConditionsReadout over a 300-case grid of open-water heights x wave periods (both sides of the 4 s steepness reference) x shore discounts, and checks the number the card, map and beach page print never lands in the calm band while the open sea is above the calm line. Also asserts one-directionality (the guard may only raise), that it never exceeds the open-water reading, that single-band drops stay untouched, and two named commitments (Παραλία Μαραθώνα must be lifted; a genuine calm cove at 0,3 m must not).',
    protects: 'Prevents a false calm the visitor reads as a promise. The protected-shore x0,5 discount (waveCharacter.SHORE_DAMPING_BY_EXPOSURE) crosses both band lines in one move: on a meltemi day Παραλία Μαραθώνα printed 0,69 m — «ήρεμα» — over a 1,38 m sea, beside a swim verdict of «μην κολυμπήσεις» and an orange pin. Three messages, the most specific one false. Measured nationally on TWO replayed meltemi days (110/110 regions, 2.873 beaches): 105 beaches (3,7%) on 2022-09-06 and 178 (6,2%) on 2024-06-29 crossed into the calm band, and in BOTH windows 100% of them sat under a pin that was not calm. A first, narrower version guarded only the double jump and excused single-band drops as «usually a good verdict»; measurement reversed that — 108 of 121 single drops carry a warning, only 13 say good. The sibling gate wave-display-agreement cannot see these — it only fires when the wind blows ONTO the shore, and these are exactly the offshore-wind cases where the discount is paid.',
    failureAction: 'Fix the guard in utils/beachConditionsReadout.ts. NEVER relax it to make a case pass — that restores the false calm. And never narrow it back to double jumps only: single-band drops were measured and 89% of them carry a warning verdict. The x0,5 itself is unmeasured and has no external judge (PORISMA §7δ); this gate guards the symptom, not the cause.',
    command: process.execPath,
    args: ['scripts/validateShoreBandJump.mjs'],
  },
  {
    id: 'script-types',
    title: 'The build tools still compile',
    description: 'Type-checks every .ts file under scripts/ with the exact flags buildGeospatialExposureProfiles uses on its own tool. tsconfig.json covers components/hooks/pages/services/utils but NOT scripts/, so npm run typecheck is green while a data builder is broken.',
    protects: 'Prevents a silently blocked rebuild. On 21/08/2026 geospatialExposureProfiles.ts carried the new windShadow field without declaring it, so every buildGeospatialExposureProfiles exited 1 — and that builder is the only thing that carries the 2.869 baked windShadow and 2.782 marineSamplePoint values forward. It passed commit, tsc --noEmit and 63 quality gates because none of them compile that folder.',
    failureAction: 'Fix the reported file. Do NOT add scripts/ to tsconfig.json include — that changes what the bundler treats as application code; this gate is the separate pass that keeps the tools honest.',
    command: process.execPath,
    args: ['scripts/validateScriptTypes.mjs'],
  },
  {
    id: 'ensemble-spread-parity',
    title: 'The forecast-confidence signal judges on the same scale as the card',
    description: 'Checks netlify/functions/ensemble-spread.mjs against the app: its copied Beaufort ladder must match utils/weatherUtils.getBeaufortLevel across 0-140 km/h in 0,5 steps, its four thresholds must equal the ones in scripts/measureEnsembleSpread.mjs (the tool the national numbers came from), five hand-built scenarios must classify correctly, and no confidence wording may appear outside comments.',
    protects: 'Prevents a silent divergence in a copied constant. Netlify functions do not share a bundle with the app, so the Beaufort ladder is duplicated by necessity; if one side changes the confidence brake would judge on a different scale than the card it is meant to restrain, and nothing else would notice. Also keeps the measured numbers honest: PORISMA §Γ50 quotes 22,2% of swim hours at day +5 as looking calm while the 90th percentile says 5+ Bft — those figures describe the thresholds in the measurement tool, so a threshold change in the function alone would make the bible describe something that no longer runs.',
    failureAction: 'Fix netlify/functions/ensemble-spread.mjs. Do NOT edit the measurement tool to match the function — the national figures came from the tool, so a threshold change means re-measuring nationally, not aligning on paper.',
    command: process.execPath,
    args: ['scripts/validateEnsembleSpread.mjs'],
  },
  {
    id: 'dry-sector-gate',
    title: 'The dry-sector bypass may only calm, and only where there is no water',
    description: 'Runs every high-confidence beach against all 8 wind sectors at three wind speeds and checks the shore-wave gate that bypasses the onshore test when the geometry reports no water in the wind\'s half-circle: the printed figure never rises, the shore height stays strictly below the open-water reading, no sector unlocks while an opening wider than 2 km sits within ±90° of the wind, and four named commitments hold (Λιμανάκια Βουλιαγμένης 22 and Πάνορμος Νάξου 2011 must NOT unlock; Σταφίδα 2186 and Άγιος Ιωάννης Πόρτο 2151 must).',
    protects: 'Prevents a false calm — the one error direction that can put a swimmer in waves. The bypass exists because 2.082 sectors on 1.318 beaches print the open-sea figure with no water in front of them (1.721 already labelled «Προστατευμένη»), but "zero fetch" alone is not proof: 1.869 of those (89,8%) have an opening of 5 km or more right beside them, and a ±45° arc still let 520 of them through. Measured nationally 17/08/2026 over 110 regions and 2.872 beaches: 61 beaches calmer (2,1%), 0 rougher, 2 verdict changes. Five sabotage runs, five reds.',
    failureAction: 'Fix utils/shoreWave.ts. NEVER widen the arc or raise the 2 km opening threshold to make a case pass — the wide versions were measured and rejected (docs/team/PORISMA-KAIROS-2026-08.md §Γ21), and widening them is exactly the failure this gate was written to catch.',
    command: process.execPath,
    args: ['scripts/validateDrySectorGate.mjs'],
  },
  {
    id: 'arriving-sea-shore-gate',
    title: 'The shore estimate may not call flat a sea that is measurably arriving',
    description: "Checks utils/shoreWave.isSeaArrivingShore against the real Σταλίδα profile and against the three beaches the shore estimate was written for, then fuzzes 20.000 random inputs to prove the flag is strictly one-directional: with an arriving sea the estimate returns silence and NEVER a different number, and with the flag off it is byte-identical to omitting it. Also asserts the onshore threshold is the SAME constant utils/seaArrival uses, so the card and the pin cannot drift apart about whether water gets in.",
    protects: 'Prevents a false calm on the most ordinary summer morning there is. The two geometric gates in utils/shoreWave ask only where the WIND comes from; on 21/08/2026 Σταλίδα (645) printed the 0,10 m floor — «θάλασσα λάδι» — under a southerly land breeze while ewam had 0,28-0,30 m arriving from 322° onto a 24,2°-facing shore through 10-25 km of open water, and a visitor standing on the beach reported chop. Same family as Καβαλικευτά (13/08), where the identical blind spot was closed one file over. Measured nationally: strictly upward, no map colour moved.',
    failureAction: 'Fix utils/shoreWave.ts. Never make a case pass by lowering ARRIVAL_ONSHORE_MIN or ARRIVAL_MIN_FETCH_KM — they are shared with the light-wind cap in utils/waveModel, and moving them here silently moves what the whole app believes about arriving water.',
    command: process.execPath,
    args: ['scripts/validateArrivingSeaShoreGate.mjs'],
  },
  {
    id: 'offshore-wind-note',
    title: 'The offshore-wind line speaks rarely, and never reassures where it must not',
    description: "Runs utils/offshoreWindNote against every committed windShadow (2.869 beaches) plus ten behavioural assertions, and pins the named witness both ways: Λυγαριά 636 MUST speak for wind from 310° and 314° (the two angles Miltos reported, land at 0,13-0,20 km) and MUST stay silent for 15°/30°/45°, where the cove mouth genuinely lets sea in. Also checks the borrowed thresholds have not drifted from FLAT_WATER_SEA_STATE_M / SEA_STATE_AMBER_M, that scripts/buildWindShadow bakes at the same 0,3 km the rule reads, and that both phrases exist in all five languages.",
    protects: 'Prevents a false calm from the one channel allowed to reassure. Three rules that would have LOWERED the number were built, measured nationally and rejected (PORISMA §Μ6: 20.311/40.166 hours, 2.217 pin colours; the narrow-mouth variant 783; the period axis 21/08, no discrimination — 96,8% of the country under 5 s). This line changes no number, colour, verdict or ranking; it only speaks. What keeps it rare is the WAVE WINDOW, not the geometry: measured 21/08, 98,5% of beaches could fire at some wind and 8,85 of 24 directions qualify on average, while the shipped rule prints on 0,8% of hours and 3,2% of beaches. Widening the window turns it into wallpaper in one line.',
    failureAction: 'Fix utils/offshoreWindNote.ts or re-run node scripts/buildWindShadow.mjs. Never make a case pass by widening OFFSHORE_NOTE_MIN_WAVE_M downward or narrowing OFFSHORE_NOTE_WINDOW_DEG — without the wave window the line printed on 21% of hours and 41,5% of beaches, and 87% of those hours had under 0,2 m of wave (reports/offshore-wind-note/frequency.json).',
    command: process.execPath,
    args: ['scripts/validateOffshoreWindNote.mjs'],
  },
  {
    id: 'open-water-label',
    title: 'The wave figure names its water, and the card says why',
    description: 'Runs every beach with committed geometry against all 8 wind sectors through the real utils/coveWaveGuard, and checks the reading is labelled «Κύμα ανοιχτά» only where the number really is the area grid — never where the guard swapped in our own near-shore SMB. Then checks the card can still be understood: seaOpen and SHELTER_LABEL are present, non-empty and distinct in all five languages, the component renders both, and BeachDetailPage still passes weatherNow.liveSentence plus a shelter word derived from the map-aligned exposure level.',
    protects: 'Prevents the page presenting an offshore grid reading as the water in front of the beach, and prevents it doing so with no explanation. Measured nationally 01/08/2026 (2.553 beaches, ewam, 15:00): the wave travels away from the shore on 1.148 of them (45%) and parallel on 352 (13,8%) — 501 beaches (19,6%) showed a >= 0,8 m figure that never reaches them. Reported as «Βραυρώνα 2,0 m orange beside Ραφήνα 1,3 m red». The explanation half is not hypothetical: weatherNowCopy built that sentence in five languages, the rebuilt card stopped rendering it on 31/07, and the statesShoreIncidence flag went on suppressing the second copy lower down — so both explanations disappeared together and all 19 gates stayed green.',
    failureAction: 'Restore the label and explanation wiring in components/BeachAnswerHero.tsx and pages/BeachDetailPage.tsx. Never make it pass by moving the NUMBER — a downward cap on a lee shore was measured and rejected (docs/team/99-decision-log.md, 29/07/2026). Only the words around it may change.',
    command: process.execPath,
    args: ['scripts/validateOpenWaterLabel.mjs'],
  },
  {
    id: 'beach-marine-resolution',
    title: 'Every beach asks about its own shore',
    description: 'Resolves the marine sample point for all 2.850 beaches over the committed geometry and checks four things: beaches whose facing differs by more than 90° and whose sample points lie more than 5 km apart never share one request; no requested coordinate is invented (only a committed marineSamplePoint or the region point); the count of beaches with no geometry of their own has not grown past 295; and the per-beach forecast object changes ONLY its marine block, leaving wind, weather and temperature identical by reference. It also proves the wiring exists at all — that useWeather resolves the points and App applies them.',
    protects: 'Prevents a beach being told about someone else\'s sea. Until 01/08/2026 every beach was scored from one region cell — 40 beaches on Lemnos, 129 on Evia, one number — so Γομάτι (faces NE) and Κάσπακας (faces W), 11 km apart on opposite coasts, both printed 1,3 m while ewam read 1,80 and 1,20 at their own shores. The rule about object identity is the other half: it stops this quietly becoming a per-beach WIND change, which would move the Beaufort figure, the exposure colour and the freshness clock without anyone deciding to.',
    failureAction: 'Wire the resolver back up, or fix the geometry that regressed. Never make it pass by grouping beaches onto shared points or by widening OPPOSING_DISTANCE_KM — both are ways of restoring the defect. The gate asserts about the REQUEST, never the printed number: a rule on the number would fire falsely against the wind-chop floor in utils/waveModel, which does not move.',
    command: process.execPath,
    args: ['scripts/validateBeachMarineResolution.mjs'],
  },
  {
    id: 'grazing-sea-relief',
    title: 'Η θάλασσα που περνάει ξυστά ρίχνει αριθμό, ποτέ προειδοποίηση',
    description: 'Οδηγεί την πραγματική shoreSeaStateM σε 162 συνδυασμούς ύψους × έκθεσης × άφιξης και τον πραγματικό κινητήρα σε fixture με έκθεση «partial»: η έκπτωση ×0,5 δίνεται ΜΟΝΟ σε partial ακτή που η θάλασσα την προσπερνάει ≥90°, ποτέ δεν βγάζει νούμερο ψηλότερο απ᾽ ό,τι πριν τις 22/08, και το «μην κολυμπήσεις» μένει όρθιο ακόμα κι όταν το ύψος πέφτει στο μισό.',
    protects: 'Η έκπτωση αγγίζει τον αριθμό που τυπώνεται σε κάρτα, χάρτη και σελίδα παραλίας. Η μέτρηση της 22/08 (40.180 βαθμολογήσεις) βρήκε 0 σβησμένες προειδοποιήσεις — αλλά σε ΗΡΕΜΗ μέρα· σε μελτέμι η ίδια έκπτωση κουνάει το τυπωμένο ύψος ως και 1,40 μ. (§Γ47), οπότε χωρίς φρένο μια γεωμετρική εικασία θα μπορούσε να σβήσει την πιο βαριά λέξη που λέμε.',
    failureAction: 'Αν έσπασε το Ε, ΜΗΝ σβήσεις τη δοκιμή: το φρένο στο services/recommendationService (grazingSeaReliefApplied) έπαψε να δουλεύει. Αν έσπασε το Α ή το Β, κάποιος χαλάρωσε τη shoreSeaStateM προς τα πάνω. Αν λέει ότι το fixture δεν βγάζει πια «partial», ρύθμισε άνεμο/ένταση τομέα μέχρι να ξαναβγεί — μη χαλαρώσεις τον έλεγχο.',
    command: process.execPath,
    args: ['scripts/validateGrazingSeaRelief.mjs'],
  },
  {
    id: 'sample-bearing-within-facing',
    title: 'Καμία παραλία δεν ρωτάει για τη θάλασσα πίσω από την πλάτη της',
    description: 'Διαβάζει κάθε κομμιταρισμένο marineSamplePoint και ελέγχει ότι η γωνία στην οποία σπρώχνεται το σημείο δεν απέχει πάνω από 90° από το facingDeg της παραλίας. Τα σφραγισμένα ως verified ΔΕΝ εξαιρούνται.',
    protects: 'Μέχρι τις 22/08/2026 το resolveSampleBearing, όταν ο τομέας του προσώπου δεν είχε 8 χλμ ανοιχτό νερό, πετούσε την κατεύθυνση της παραλίας και έπαιρνε τον πιο ανοιχτό τομέα χωρίς όριο γωνίας — και η σκάλα του optimiseMarineSamplePoints έκανε το ίδιο και σφράγιζε το αποτέλεσμα ως verified, δηλαδή προστατευμένο κι από το build. 14 παραλίες ρωτούσαν για νερό >90° μακριά από αυτό που κοιτούν· η Κολώνα στην Άνδρο κοιτάει 89,9° και ρωτούσε στις 270°, την απέναντι θάλασσα του νησιού. Η διπλανή πύλη beach-marine-resolution δεν το έβλεπε: ελέγχει ότι κάθε παραλία ρωτάει ΞΕΧΩΡΙΣΤΑ, όχι ότι ρωτάει για ΤΟ ΔΙΚΟ ΤΗΣ νερό.',
    failureAction: 'Τρέξε `node scripts/buildMarineSamplePoints.mjs`. Αν μια παραλία επιμένει, σβήσε το πεδίο verified από το marineSamplePoint της και ξανατρέξε. ΠΟΤΕ μην την περάσεις ανεβάζοντας το MAX_FACING_DIVERSION_DEG — το όριο είναι ο λόγος που υπάρχει η πύλη.',
    command: process.execPath,
    args: ['scripts/validateSampleBearingWithinFacing.mjs'],
  },
  {
    id: 'near-me-geometry',
    title: 'The cross-region view keeps its geometry',
    description: 'Builds a synthetic "Κοντά μου" region the way the app does and checks the loader never requests a profile file for it, resolves each beach to its OWN geometry under the re-keyed id, and asks once for a file that is genuinely missing.',
    protects: 'Prevents the whole "Κοντά μου" list from silently collapsing onto one area sea cell for beaches up to 40 km apart, which is what a 404 on a synthetic region id costs.',
    failureAction: 'Route the call through loadGeospatialExposureProfilesForBeaches in services/geospatialExposureService.ts — it owns the merge. Never make it pass by adding a near-me.json to the build: the region is assembled per user from their GPS and has no fixed beach list to build a file from.',
    command: process.execPath,
    args: ['scripts/validateNearMeGeometry.mjs'],
  },
  {
    id: 'swell-origin-copy',
    title: 'The card says where the sea came from',
    description: 'Drives the beach page\'s live sentence in all five languages over a measured light-wind/running-sea reading and checks it names the direction the swell arrived from — then checks it stays completely silent on ordinary short-period chop, on a swell too small to matter, on a swell that is only part of the sea, and when no direction is known. Also checks the origin phrase itself is a whole per-language string («από τα βόρεια», «de l\'est») and that the beach page still hands the swell channel over.',
    protects: 'Prevents a correct page reading like a broken one. Reported from Ταυρωνίτης (Χανιά) 02/08/2026: 2 Bft on the compass over a 1,6 m sea, with no explanation anywhere on the page — measured the same hour, the local wind was making 0,16 m of its own and 1,26 m at 5,7 s was arriving from the north. The existing swell section could not help: it only opens above 7 s, a bar an ordinary Aegean swell never clears. The silence rules matter as much as the sentence — inventing a cause for ordinary wind chop would be worse than the silence it replaced. It also holds the Greek phrase away from the masculine wind adjective, which had already shipped as «από τα Βόρειος» in the swell section.',
    failureAction: 'Restore the wiring or the clause the gate names. Never widen a threshold to make a case speak — the sentence is only allowed where the marine reading carries it, and it must never change a score, a colour or a verdict.',
    command: process.execPath,
    args: ['scripts/validateSwellOriginCopy.mjs'],
  },
  {
    id: 'choppy-sea-copy',
    title: 'Το χαμηλό αλλά σπαστό κύμα δεν περνάει σιωπηλά',
    description: 'Ελέγχει ότι η γραμμή «κοντό και σπαστό κύμα» (utils/choppySeaCopy) φτάνει όντως σε οθόνη — ΚΑΛΕΙΤΑΙ και ΖΩΓΡΑΦΙΖΕΤΑΙ στη σελίδα παραλίας, με όριο λέξης ώστε ένα μετονομασμένο κάλεσμα να μη γλιστράει. Μετά: πληρότητα και μοναδικότητα σε 5 γλώσσες πάνω στην πραγματική περίπτωση που τη γέννησε (0,68 μ. @ 3,3 δλ), απαγόρευση ύψους σε μέτρα μέσα στο κείμενο, κλείδωμα των δύο μετρημένων σταθερών, και πλέγμα 400 συνδυασμών ύψους × περιόδου × χρώματος όπου η γραμμή πρέπει να σωπαίνει σε ήπιο κύμα, σε αποθάλασσα και πάνω από χρώμα που ήδη προειδοποιεί.',
    protects: 'Εμποδίζει έναν ολόκληρο άξονα του μοντέλου να μπει μισός. Το `isShortPeriodSea` γράφτηκε 28/07/2026 με σχόλιο «Used only to choose wording» και έζησε 18 μέρες με ΜΗΔΕΝ καταναλωτές: ο αριθμός μετρούσε την αποτομότητα, καμία λέξη δεν την ανέφερε ποτέ. Αποκαλύφθηκε από αναφορά επισκέπτη «Είχε κύμα» για τη Σκάλα Κεφαλονιάς (3105) στις 15/08/2026 — 0,68 μ. στα 3,3 δλ, σοβαρότητα 0,79 έναντι κατωφλιού 0,80, δηλαδή διπλή σιωπή: το χρώμα έχασε για ένα εκατοστό ΚΑΙ η γλώσσα δεν είχε καλωδίωση. Η σπανιότητα φυλάσσεται εξίσου σκληρά: με σκέτη κοντή περίοδο η γραμμή θα έβγαινε στο 43,6% των παραλιών, δηλαδή μόνιμη ταμπέλα.',
    failureAction: 'Επανάφερε την καλωδίωση ή τη ρήτρα που ονομάζει η πύλη. ΜΗΝ χαλαρώσεις κατώφλι για να μιλήσει μια περίπτωση — τα δύο νούμερα βγήκαν από εθνική μέτρηση (scripts/measureChopExponent.mjs) και αλλάζουν μόνο μαζί με νέα μέτρηση γραμμένη στη βίβλο.',
    command: process.execPath,
    args: ['scripts/validateChoppySeaCopy.mjs'],
  },
  {
    id: 'per-beach-wind-gates',
    title: 'Every wind gate asks the beach\'s own shore',
    description: 'Reads every call site that decides something about ONE beach — hide the boat-only beaches, demand wind evidence, put shelter before score, switch the list filter on — and fails if any of them is back on the single wind measured at the region\'s geometric centre. Then drives the real ranking functions with fixtures: a calm shore must not be demoted by a region that blows, a shore that blows must be demoted by a region that reads calm, and a pool with no per-beach readings at all must rank exactly as it did before.',
    protects: 'Prevents the region number deciding what a person is shown. Measured nationally 02/08/2026 over 8.550 beach-hours: the centre\'s wind is a Beaufort or more away from the beach\'s own shore 35,9% of the time and 1.171 of 2.850 beaches landed on the wrong side of a threshold at least once — 889 beach-hours thrown out of the recommendations though their own water was calm, 574 kept with no evidence while it blew, 150 able to reach #1 over 5 Bft of their own water, and two boat-only beaches on Karpathos still offered while 5 Bft blew where the boat sails. The region-wind fallback is guarded just as hard: it is what ranks the trip planner, the prerender and every beach whose cluster fetch has not landed yet.',
    failureAction: 'Pass the beach\'s own wind at the call site the gate names (App.beaufortAtBeach / perBeachMapWind). Never make it pass by deleting a rule — and never make the ranking functions REQUIRE the per-beach map, because the surfaces that do not have one must keep working.',
    command: process.execPath,
    args: ['scripts/validatePerBeachWindGates.mjs'],
  },
  {
    id: 'departing-sea-evidence',
    title: 'Ο αριθμός πέφτει μόνο με μετρημένη απόδειξη ότι το νερό φεύγει',
    description: 'Οδηγεί τις πραγματικές utils/shoreWave.isSeaDepartingShore και estimateShoreWaveHeightM και απαιτεί: μετωπικό κύμα ή θαλάσσιος άνεμος δεν περνάνε ποτέ· ένα και μόνο συστατικό που έρχεται ακυρώνει τα υπόλοιπα· ύψος χωρίς κατεύθυνση σημαίνει σιωπή· τα ΔΥΟ κατώφλια τηρούνται χωριστά — άνεμος −0,80, νερό −0,65 (22/08/2026) — και η πύλη σκάει αν κάποιος τα ξαναενώσει· και το ξεκλείδωμα δεν παρακάμπτει ΤΙΠΟΤΑ άλλο — αποθαλασσιά που φτάνει, χαμηλή εμπιστοσύνη, ύποπτη πινέζα και η ράμπα κρατάνε. Ελέγχει και τη ΣΥΝΔΕΣΗ στο recommendationService. Με --prove χαλαρώνει και σφίγγει την ίδια τη σταθερά μέσα στην αληθινή συνάρτηση και απαιτεί να πέσει.',
    protects: 'Κάνει παραλίες να δείχνουν ΠΙΟ ΗΡΕΜΕΣ, δηλαδή είναι η επικίνδυνη κατεύθυνση — σκανδάλη #1 της §9. Αφορμή: Ελαφονήσι 15/08/2026 16:00, ζωντανή κάμερα με ρηχό ήρεμο νερό ενώ η κάρτα έλεγε 0,7 μ. — η θάλασσα 10 χλμ ΚΑΤΑΝΤΗ έδινε 1,22 μ. με onshore −0,94, δηλαδή όλο το νερό έφευγε. Μετρήθηκε εθνικά (2.768 παραλίες × 14 ώρες): στο −0,8 αγγίζονται 8 παραλίες / 44 ώρες×παραλία με μέγιστη πτώση 0,96 μ. και ΚΑΜΙΑ πτώση από ≥1 μ. στο δάπεδο· στο −0,5 γίνονται 576 ώρες×παραλία με άλματα ως 1,52 μ. 1.872 παραλίες την ίδια ώρα έχουν θάλασσα που έρχεται και δεν αγγίζονται καθόλου.',
    failureAction: 'ΜΗΝ χαλαρώσεις κατώφλι για να μιλήσει μια παραλία — και τα δύο βγήκαν από μέτρηση: ο άνεμος −0,80 (16/08), το νερό −0,65 (22/08, 4 παράθυρα, ~155.500 ώρες×παραλία). Στο −0,60 εμφανίζονται οι πρώτες καταρρεύσεις από ≥1 μ. στο δάπεδο· το −0,5 δοκιμάστηκε δύο φορές και απορρίφθηκε. Αν λείπει η σύνδεση, πέρασε το departingSea στο estimateShoreWaveHeightM· ΠΟΤΕ μην παρακάμψεις τη ράμπα, την αποθαλασσιά ή τον φραγμό «ποτέ πιο δυνατά από την ανοιχτή θάλασσα».',
    command: process.execPath,
    args: ['scripts/validateDepartingSeaEvidence.mjs', '--prove'],
  },
  {
    id: 'over-caution-relief',
    title: 'Το άθροισμα των ποινών δεν αρνείται μπάνιο πάνω από ήρεμο νερό',
    description: 'Οδηγεί την πραγματική utils/overCautionRelief.relievesOverCaution και απαιτεί: ποτέ ανακούφιση στα ≥5 Μποφόρ, ποτέ πάνω από 0,6 μ. νερό ΣΤΗΝ ΑΚΤΗ, παραμερισμός για επίσημη προειδοποίηση / μετωπική αποθαλασσιά / κυματισμό μεγάλης περιόδου, σιωπή σε άκυρα δεδομένα, και τα 4 Μποφόρ ΜΟΝΟ με μετρημένη απόδειξη ότι όλο το νερό φεύγει. Ελέγχει επίσης τη ΚΑΛΩΔΙΩΣΗ: ότι το recommendationService δίνει το νερό της ΑΚΤΗΣ και όχι το effectiveWaveHeightM, και ότι η ανακούφιση μένει ένα σκαλί (avoid_swimming → caution). Με --prove αντικαθιστά τη συνάρτηση με τρεις χαλασμένες εκδοχές και απαιτεί να πέσουν οι κανόνες.',
    protects: 'ΑΦΑΙΡΕΙ προειδοποίηση, άρα είναι η επικίνδυνη κατεύθυνση. Αφορμή: Ελαφονήσι 22/08/2026, χρήστης στην παραλία λέει «λάδι» και η σελίδα λέει «μην κολυμπήσεις» — νερό στην ακτή 0,41 μ., άνεμος 4 Μποφόρ απόγειος. Ο κανόνας της 10/08 που εμποδίζει το ΑΘΡΟΙΣΜΑ να αρνηθεί μπάνιο ρωτούσε το effectiveWaveHeightM, δηλαδή τη θάλασσα ~10 χλμ ανοιχτά: ο φρουρός απέναντι στην υπερβολική αυστηρότητα ρωτούσε το νούμερο που την προκαλεί — το ίδιο ελάττωμα που το swimmingComfortFromScore καταγράφει ως «THE SHORE BRANCH WAS DEAD ON ARRIVAL», ένα σκαλί πιο κάτω, αδιάγνωστο για 12 μέρες. Μετρήθηκε εθνικά σε 3 παράθυρα (~120.700 ώρες×παραλία): αλλάζουν 55, ΟΛΕΣ ένα σκαλί προς το ηπιότερο, ΚΑΜΙΑ στα ≥5 Μποφόρ, διάμεσο νερό ακτής 0,29-0,42 μ.',
    failureAction: 'ΜΗΝ χαλαρώσεις κατώφλι για να περάσει μια παραλία. Αν σπάει ο έλεγχος καλωδίωσης, δώσε ξανά το shoreWaveM στο seaAtShoreM — ποτέ το effectiveWaveHeightM. Το ταβάνι των 4 Μποφόρ κλειδώνει στο shoreWaveFromDepartingSea και σε τίποτε άλλο: γεωμετρική εικασία ΔΕΝ αρκεί.',
    command: process.execPath,
    args: ['scripts/validateOverCautionRelief.mjs', '--prove'],
  },
  {
    id: 'water-question-routing',
    title: 'Κανένα σημείο δεν διαλέγει σιωπηλά ποιο νερό θα ρωτήσει',
    description: 'Κρατάει παγωμένο τον κατάλογο των γραμμών του recommendationService που διαβάζουν την ΑΝΟΙΧΤΗ θάλασσα (effectiveWaveHeightM), με μία δικαιολογία η καθεμία. Νέα γραμμή που δεν είναι δηλωμένη ρίχνει την πύλη· δηλωμένη που εξαφανίστηκε επίσης, ώστε ο κατάλογος να μη σαπίζει. Ελέγχει επιπλέον ότι υπάρχουν οι δύο ονομασμένοι αριθμοί — seaAtShoreM (το νερό της παραλίας) και seaForCautionM (αυστηρότερος, μόνο μετρημένη απόδειξη μπορεί να σβήσει προειδοποίηση) — ότι η προειδοποίηση rough_sea διαβάζει τον αυστηρό, και ότι ο αριθμός της ακτής υπολογίζεται ΠΑΝΩ από την πρώτη ερώτηση που τον χρειάζεται.',
    protects: 'Το ΙΔΙΟ λάθος γράφτηκε τέσσερις φορές — Σχινιάς 05/08, Ωρωπός 10/08, Καβαλικευτά 13/08, Ελαφονήσι 22/08 (τρία σημεία σε μία μέρα) — επειδή κανένας κανόνας δεν έλεγε ποια ερώτηση παίρνει ποιο νερό, και επειδή ο αριθμός της ακτής υπολογιζόταν ~500 γραμμές ΜΕΤΑ τα κείμενα που τον χρειάζονταν. Κάθε φορά η διόρθωση γραφόταν στη βίβλο ως περιστατικό — ημερολόγιο τραυμάτων, όχι συνταγή — και το επόμενο σημείο το ξανάκανε. Αποτέλεσμα στην οθόνη: η κάρτα τύπωνε «~0,4 μ.» και από κάτω «Some wave risk (0.9 m)».',
    failureAction: 'Απάντησε ΡΗΤΑ τι ρωτάει το νέο σημείο. Για την ΠΕΡΙΟΧΗ (μοντέλο, ταβάνι, ένδειξη «ανοιχτά», ό,τι δαμπάρει μόνο του) → πρόσθεσέ το στον κατάλογο ALLOWED με δικαιολογία. Για την ΠΑΡΑΛΙΑ (κείμενα, βαθμοί, ετυμηγορία) → seaAtShoreM. Για να ΣΒΗΣΕΙΣ προειδοποίηση → seaForCautionM και τίποτε άλλο. `--list` τυπώνει τον τρέχοντα κατάλογο.',
    command: process.execPath,
    args: ['scripts/validateWaterQuestionRouting.mjs'],
  },
  {
    id: 'forecast-cell-clustering',
    title: 'No forecast point speaks for a beach in another model cell',
    description: 'Runs the shipped clustering over all 110 regions and demands four things: every beach carries a MEASURED forecastCell, every cluster\'s members share one cell, every cluster\'s sampling point is literally a member beach\'s coordinate rather than a synthetic centroid, and that beach\'s own measured cell is the cluster\'s cell.',
    protects: 'Prevents the app quoting a beach the wind of somewhere else. Open-Meteo does not answer from the nearest grid cell — the default cell_selection=land walks a 90 m elevation model to a LAND cell of similar height — so a centroid is a coordinate nobody probed. Measured 15/08/2026 nationally: 306 of 2.791 beaches (11,0%) were being fed a foreign cell\'s wind. Elafonisi is the worked example: its centroid sat 3,51 km away in a 34 m cell reading 50,9 km/h while the beach sat in a 1 m cell reading 43,2 km/h, so the card said «Δυνατός αέρας 7 Μπφ» for a beach having 6 while a live webcam showed flat water.',
    failureAction: 'Re-bake with `node scripts/bakeForecastModelCells.mjs` if the beach data was rebuilt without it. NEVER make this pass by sending a centroid again, and never widen MAX_SAMPLING_DISTANCE_KM to "fit" — distance was exactly the assumption that failed: 4 km was calibrated believing the grid was 0,25°, and it is ~0,0625°.',
    command: process.execPath,
    args: ['scripts/validateForecastCellClustering.mjs'],
  },
  {
    id: 'netlify-toml',
    title: 'Το αρχείο που ανεβάζει το site διαβάζεται — και δεν δίνει το δωρεάν πακέτο στους επισκέπτες',
    description: 'Διαβάζει το netlify.toml σαν TOML (με σωστό μοντέλο συστοιχιών: [[redirects]] και [[headers]] νόμιμα επαναλαμβάνονται, το [headers.values] ανήκει στο στοιχείο πριν από αυτό) και απαιτεί: καμία απλή ενότητα ορισμένη δύο φορές, κανένα κλειδί διπλό μέσα στην ίδια ενότητα, καμία γραμμή που δεν είναι σχόλιο/ενότητα/ανάθεση, κανένα ξεχασμένο εισαγωγικό, και ύπαρξη του [build]. Μετά ελέγχει τη ρήτρα άδειας: OPEN_METEO_USE_FREE_TIER απαγορεύεται στην παραγωγή. Τέλος σαμποτάρει το ίδιο του το κείμενο με μια διπλή ενότητα και απαιτεί να πέσει.',
    protects: 'Ένα σπασμένο netlify.toml περνάει ΚΑΘΕ άλλη πύλη — όλες διαβάζουν κώδικα και δεδομένα, καμία δεν διάβαζε τη ρύθμιση που τα ανεβάζει — και μετά ρίχνει το deploy. Συνέβη 17/08/2026: βρέθηκε διπλογραμμένη ενότητα στο δέντρο, με τις 50 πύλες πράσινες. Η δεύτερη μισή δουλειά είναι νομική: το δωρεάν επίπεδο του Open-Meteo έχει άδεια μη-εμπορικής χρήσης, το calmbeach.gr είναι εμπορικό προϊόν, και μέχρι σήμερα αυτό το φυλούσε ένα σχόλιο δίπλα στη γραμμή.',
    failureAction: 'Διόρθωσε το netlify.toml στο σημείο που λέει ο αριθμός γραμμής. ΠΟΤΕ μη χαλαρώσεις τον έλεγχο άδειας για να περάσει μια δοκιμή: το δωρεάν πακέτο ανήκει σε deploy-preview / branch-deploy / dev και πουθενά αλλού. Αν χρειαστεί νέο είδος ενότητας που όντως επαναλαμβάνεται στο TOML, πρόσθεσέ το στο REPEATABLE — μη σβήσεις τον έλεγχο διπλής ενότητας.',
    command: process.execPath,
    args: ['scripts/validateNetlifyToml.mjs'],
  },
  {
    id: 'curated-cove-stays-on-the-wind',
    title: 'Η επιθεώρηση του όρμου ισχύει για τον άνεμο, όχι για το κύμα',
    description: 'Οδηγεί τις πραγματικές geometryEnclosedProtectionSource και shoreSeaStateM πάνω σε ΟΛΑ τα geospatial προφίλ και απαιτεί πέντε πράγματα: (Α) κάθε τομέας που παίρνει προστασία σημαδεύεται σωστά «geometry» ή «curated», και το «curated» εμφανίζεται ΜΟΝΟ εκεί που το αυστηρό τεστ του χάρτη αποτυγχάνει· (Β) με το σήμα ανοιχτό το shoreSeaStateM αρνείται την έκπτωση ×0,5 σε κάθε ύψος θάλασσας· (Γ) σε καμία είσοδο (4 επίπεδα × 4 αφίξεις × 8 ύψη) η διόρθωση δεν βγάζει ΜΙΚΡΟΤΕΡΟ κύμα· (Δ) καμία παραλία εκτός CURATED_ENCLOSED_COVE_IDS δεν παίρνει «curated», και το παλιό hasGeometryEnclosedProtection συμφωνεί με τη νέα ετικέτα σε κάθε τομέα· (Ε) σαμποτάρει τον εαυτό της καλώντας τη συνάρτηση όπως ο παλιός κώδικας και απαιτεί να διαφέρει.',
    protects: 'Η curated παράκαμψη (17/08/2026) δίνει σε 29 τομείς / 24 επιθεωρημένες παραλίες exposureLevel «protected» χωρίς να περάσουν το αυστηρό γεωμετρικό τεστ — ένταση 33,0-59,6 έναντι κατωφλίου 33. Δύο σχόλια υπόσχονταν ότι αυτό δεν αγγίζει το κύμα· και τα δύο ήταν ψευδή. Για δεκαπέντε ημέρες το «protected» έφτανε αυτούσιο στο shoreSeaStateM και ΚΟΒΕ ΤΟ ΚΥΜΑ ΣΤΟ ΜΙΣΟ, δηλαδή έκπτωση για δοκιμή που δεν έδωσαν ποτέ, και μαζί έβαζε τις παραλίες στο φίλτρο «Ήρεμο νερό» με ανοιχτή θάλασσα ως 0,80 μ. Το βρήκε αντίπαλος έλεγχος στις 20/08, ΟΧΙ πύλη — γιατί πύλη δεν υπήρχε: το quality:verdicts περνάει το ΙΔΙΟ input σε κάρτα και πινέζα, άρα είναι τυφλό εξ ορισμού σε κάθε διαφορά τους.',
    failureAction: 'ΠΟΤΕ μην περάσεις αυτή την πύλη σβήνοντας κανόνα. Αν πρόσθεσες παραλία στο CURATED_ENCLOSED_COVE_IDS, ο τομέας της πρέπει να έχει fetchKm 0 και level ≠ exposed. Αν άγγιξες το shoreSeaStateM, το τέταρτο όρισμα ΠΡΕΠΕΙ να αρνείται την έκπτωση: η ανθρώπινη επιθεώρηση αφορά τη μορφολογία απέναντι στον ΑΝΕΜΟ, κανείς δεν επιθεώρησε το ΚΥΜΑ. Και μη λύσεις το πρόβλημα δίνοντας την παράκαμψη στον χάρτη — δοκιμάστηκε και αναιρέθηκε 17/08, διαρρέει σε γείτονες μέσω hasCuratedSegmentProtectionSupport (§Γ15).',
    command: process.execPath,
    args: ['scripts/validateCuratedCoveWindOnly.mjs'],
  },
  {
    id: 'gust-floor-contract',
    title: 'Ο δάπεδος ριπής ανεβάζει τον άνεμο και δεν σβήνει τις προειδοποιήσεις του',
    description: 'Οδηγεί τις πραγματικές applyGustFloor και calculateBeachScore, χωρίς δίκτυο, και απαιτεί έξι πράγματα: (Α) οι δύο πόρτες ανοίγουν όπου πρέπει — σε σημείο με στεριά ο δάπεδος ισχύει πάντα, σε σημείο στο 0 μόνο όταν ο λόγος ριπής/μέσου φτάνει το 3,5, με τα δύο σημεία εκατέρωθεν του κατωφλιού ελεγμένα· (Β) σε 8 ριπές × 6 υψόμετρα × 41 εντάσεις ο δάπεδος δεν ΚΑΤΕΒΑΖΕΙ ποτέ τον άνεμο· (Γ) χωρίς έγκυρη ριπή ή χωρίς γνωστό υψόμετρο επιστρέφει τον μέσο αυτούσιο — μια διόρθωση που δεν ξέρει πού πατάει δεν εφαρμόζεται· (Δ) οι δύο σταθερές (0,50 και 3,5) δεν έχουν μετακινηθεί· (Ε) ο ωμός μέσος φτάνει ακέραιος ως την ένταση της προειδοποίησης ριπής, ΚΑΙ με ωριαία πρόγνωση ΚΑΙ χωρίς· (ΣΤ) σαμποτάρει τον εαυτό της σβήνοντας τον ωμό μέσο και απαιτεί να πέσει η ένταση.',
    protects: 'Ο δάπεδος ριπής (18/08/2026, commit 0a350a87) στηρίζεται σε δύο αριθμούς που καμία πύλη δεν φύλαγε: το 0,50 είναι ΑΠΟΦΑΣΗ του Μίλτου πάνω σε μια συνεχή καμπύλη ανταλλαγής — κάθε σκαλί προς τα πάνω κόβει «ψεύτικες ηρεμίες» και προσθέτει «ψεύτικους συναγερμούς» — και το 3,5 είναι το μόνο κατώφλι που μετρήθηκε χωρίς τίμημα σε τέσσερα παράθυρα. Χωρίς πύλη μπορούσαν να αλλάξουν σιωπηλά και να μετακινήσουν το χρώμα 2.850 παραλιών. Και η ίδια η διόρθωση έχει ήδη δαγκώσει τον σκοπό της μία φορά: ανεβάζοντας τον μέσο μικραίνει το «ριπή μείον μέσος» και σβήνει τις προειδοποιήσεις ριπής που ήρθε να ενισχύσει (918 ώρες-παραλίες έχαναν την πύλη κύματος, 366 το +1 Μποφόρ). Η κύρια διαδρομή διορθώθηκε τότε· το ΕΦΕΔΡΙΚΟ μονοπάτι — όταν λείπει η ωριαία πρόγνωση — έμεινε πίσω και το βρήκε αυτή η πύλη στις 20/08/2026.',
    failureAction: 'Αν έπεσε το Δ, ΜΗΝ αλλάξεις τη σταθερά μέσα στην πύλη για να περάσει: το 0,50 και το 3,5 αλλάζουν μόνο με νέα απόφαση προϊόντος, με τον πίνακα ανταλλαγής του utils/windGustFloor.ts μπροστά — όχι με νέα μέτρηση, όχι με βελτιστοποίηση. Αν έπεσε το Ε ή το ΣΤ, κάπου το «πόσο ριπώδης είναι» μετριέται από τον ΔΙΟΡΘΩΜΕΝΟ μέσο· ο ωμός ζει στο wind.speedBeforeGustFloor και υπάρχει ΜΟΝΟ για αυτό (types.ts:820). Αν έπεσε το Α, θυμήσου ότι η εξαίρεση του θαλασσινού σημείου αφορά το 47,6% των σημείων ανέμου της χώρας και ότι η ομαδοποίηση κατά κέντρο κελιού δοκιμάστηκε και κόπηκε.',
    command: process.execPath,
    args: ['scripts/validateGustFloorContract.mjs'],
  },
  {
    id: 'gust-floor-consumers',
    title: 'Ο δάπεδος ριπής δεν αποκτά τρίτο αναγνώστη στα κρυφά',
    description: 'Κλειδώνει ΠΟΙΑ αρχεία της παραγωγής καλούν το applyGustFloor και ΠΟΙΑ διαβάζουν τον ωμό μέσο (speedBeforeGustFloor). Νέος καταναλωτής — ή εξαφάνιση εγκεκριμένου — ρίχνει την πύλη. Αναφέρει επίσης (χωρίς να ρίχνει) εργαλεία που κρατούν ΔΙΚΟ ΤΟΥΣ αντίγραφο του δάπεδου.',
    protects: 'Ο δάπεδος ριπής είναι διόρθωση ΜΕΡΟΛΗΨΙΑΣ, όχι φυσικό μέγεθος: μετρημένο 21/08/2026, στο 23% των ωρών που λέμε «ήρεμα» η ριπή που τον οδηγεί είναι φούσκα (μοντέλο 18,07 χλμ/ώ ριπή πάνω σε 4,6 μέσο, όργανο 7,7). Βγαίνει καθαρά κερδισμένος στο σύνολο (1.233 διορθωμένα Μποφόρ έναντι 886 χαλασμένων) και για αυτό μένει — αλλά κάθε νέα ερμηνεία του ίδιου νούμερου κληρονομεί τη φούσκα χωρίς να το ξέρει. Η πύλη δεν απαγορεύει· απαιτεί ανθρώπινο μάτι.',
    failureAction: 'ΜΗΝ προσθέσεις απλώς το αρχείο στη λίστα. Γράψε πρώτα γιατί ο ΔΙΟΡΘΩΜΕΝΟΣ αριθμός είναι ο σωστός σε αυτή τη θέση. Αν μετράς «πόσο ριπώδης είναι η ώρα», χρησιμοποίησε τον ΩΜΟ μέσο (wind.speedBeforeGustFloor) — αλλιώς ο δάπεδος σβήνει τις προειδοποιήσεις ριπής που ήρθε να ενισχύσει.',
    command: process.execPath,
    args: ['scripts/validateGustFloorConsumers.mjs'],
  },
  {
    id: 'forecast-uncertainty-brake',
    title: 'Το φρένο της αβεβαιότητας κάνει ακριβώς ένα πράγμα',
    description: 'Οδηγεί την πραγματική resolveConditionTone σε όλο το πλέγμα συνθηκών και την πραγματική calculateBeachScore, χωρίς δίκτυο. Έξι ισχυρισμοί: (Α) μονόδρομος και ένα σκαλί — η ΜΟΝΗ μετάβαση που παράγει είναι μπλε→κίτρινο και ποτέ προς το ηρεμότερο· (Β) η ΣΗΜΕΡΙΝΗ μέρα δεν σημαδεύεται ποτέ αβέβαιη, ούτε καν στα δεδομένα· (Γ) χωρίς απάντηση, με σπασμένη απάντηση ή με σβηστό διακόπτη η συμπεριφορά είναι ταυτόσημη με πριν και ο πίνακας ημερών γυρίζει αυτούσιος· (Δ) η ετυμηγορία πέφτει ΜΟΝΟ από το «ιδανικά» σε «καλά», με fixture που ελέγχεται ρητά ότι ακόμα παράγει «ιδανικά»· (Ε) η αντιστοίχιση γίνεται με ΗΜΕΡΟΜΗΝΙΑ και επιβιώνει όταν πέσει η πρώτη μέρα του πίνακα· (ΣΤ) αυτοσαμποτάζ — αν το φρένο δεν αλλάζει τίποτα πουθενά, η πύλη πέφτει αντί να δείχνει πράσινη.',
    protects: 'Είναι ο πρώτος κανόνας του μοντέλου που κρίνει με βάση το ΠΟΣΟ ΣΙΓΟΥΡΟΙ ΕΙΜΑΣΤΕ και όχι με βάση τι δείχνει η πρόγνωση — και ένας τέτοιος κανόνας μπορεί να δικαιολογήσει οποιαδήποτε αλλαγή αν κανείς δεν του κρατάει τα όρια. Μετρήθηκε πριν μπει (reports/quality/ensemble-brake-impact.json): 283 από 14.365 παραλιο-ημέρες, 113 μπλε σε κίτρινο, 83 «ιδανικά» σε «καλά». Αν κάποιος το επεκτείνει σιωπηλά στη σημερινή μέρα ή σε δεύτερο σκαλί, το κόστος πολλαπλασιάζεται χωρίς καμία νέα μέτρηση.',
    failureAction: 'ΜΗΝ χαλαρώσεις τον έλεγχο. Τα όρια είναι απόφαση με μέτρηση από πίσω (βίβλος §ΑΞ2/Α5): ένα σκαλί, μπλε→κίτρινο και «ιδανικά»→«καλά», ποτέ σήμερα, ποτέ προς το ηρεμότερο, άγνωστο σημαίνει καμία αλλαγή. Ο διακόπτης FORECAST_UNCERTAINTY_BRAKE_ENABLED στο utils/forecastUncertainty είναι ο δρόμος επιστροφής αν χρειαστεί να σβήσει.',
    command: process.execPath,
    args: ['scripts/validateForecastUncertaintyBrake.mjs'],
  },
  {
    id: 'three-beaufort-chop',
    title: 'Στα 3 Μποφόρ το κίτρινο θέλει κύμα, όχι ταμπέλα',
    description: 'Οδηγεί την πραγματική resolveConditionTone και το πραγματικό SMB πάνω σε ΟΛΟΥΣ τους 6.283 τομείς «exposed» της χώρας. Πέντε ισχυρισμοί: (Α) η ΒΑΣΗ του κανόνα ισχύει ακόμα — λίγο κάτω από τη σταθερά κανένας τομέας δεν χτίζει 0,30 μ. και λίγο πάνω της κάποιος τα χτίζει, ώστε να μην είναι ούτε χαλαρή ούτε άσκοπα σφιχτή· (Β) η συμπεριφορά εκατέρωθεν του κατωφλιού είναι μπλε/κίτρινο και ο βοηθός κλείνει σε 4 Μποφόρ και χωρίς ταχύτητα· (Γ) σε 4 επίπεδα έκθεσης × 40 ταχύτητες καμία απάντηση δεν αλλάζει έξω από το «3 Μπφ + exposed»· (Δ) χωρίς ταχύτητα το πλέγμα είναι πανομοιότυπο με πριν τον κανόνα· (Ε) το ταβάνι της θάλασσας εξακολουθεί να τραβάει πίσω μια πινέζα που ανέβηκε. Self-proves με --prove: σταθερά 19 πρέπει να τη ρίξει.',
    protects: 'Ο κανόνας των 3 Μποφόρ (20/08/2026) δεν στηρίζεται σε γούστο αλλά σε μια ιδιότητα των ΔΕΔΟΜΕΝΩΝ μας: με fetch που δεν ξεπερνάει τα 25 χλμ, κάτω από 14,8 χλμ/ώ το SMB δεν φτάνει ποτέ τα 0,30 μ. Αν αλλάξει το ταβάνι των ακτίνων, το SMB ή τα προφίλ έκθεσης, η βάση εξαφανίζεται ΣΙΩΠΗΛΑ και ο κανόνας συνεχίζει να τρέχει — βάφοντας μπλε νερό που πια δεν είναι επίπεδο. Η σταθερά γεννήθηκε λάθος (14,9) ακριβώς επειδή το SMB στρογγυλοποιεί, και αυτή η πύλη ήταν που το έπιασε.',
    failureAction: 'Αν έπεσε το Α, ΜΗΝ αλλάξεις τη σταθερά για να περάσει χωρίς να ξανακάνεις τη μέτρηση: τρέξε ξανά το SMB πάνω σε όλους τους τομείς και βρες πού πιάνει πραγματικά τα 0,30 — και γράψε το στο PORISMA §Γ30. Αν έπεσε το Γ, κάποιος επέκτεινε τον κανόνα έξω από τη μοναδική ζώνη όπου η απάντηση είναι βέβαιη· πάνω από τη σταθερά το αποτέλεσμα εξαρτάται από το fetch και ένα σκέτο όριο ταχύτητας συμφωνεί μόνο 83%. Αν έπεσε το Ε, ο κανόνας έγινε παράκαμψη αντί για σκαλί.',
    command: process.execPath,
    args: ['scripts/validateThreeBeaufortChopGate.mjs'],
  },
  {
    id: 'over-water-wind-layer',
    title: 'Το στρώμα ανέμου πάνω από νερό αγγίζει τη διεύθυνση και τίποτα άλλο',
    description: 'Οδηγεί την πραγματική applyOverWaterWindDirection χωρίς καμία κλήση δικτύου. Πέντε ισχυρισμοί: (Α) η πύλη των 3 χλμ ζει στα ΔΕΔΟΜΕΝΑ — καμία παραλία κάτω από το όριο δεν έχει κελί θάλασσας στο data/forecast-sea-cells.generated.json και καμία πάνω από αυτό δεν λείπει· (Β) σε 576 συνδυασμούς ταχύτητας × διεύθυνσης η ταχύτητα, η ριπή και ο πραγματικός μέσος βγαίνουν πανομοιότυποι, μόνο το deg κουνιέται· (Γ) κάτω από 3 Μποφόρ δεν αλλάζει ΟΥΤΕ ΜΙΑ ώρα, ακόμα και με τα δύο κελιά σε 180° διαφωνία· (Δ) ο ημερήσιος άνεμος μένει ΤΟ ΙΔΙΟ αντικείμενο με μια ώρα της ίδιας πρόγνωσης, ώστε κάρτα και χάρτης να μη διαβάζουν άλλη διεύθυνση για την ίδια στιγμή· (Ε) αυτοσαμποτάζ — το στρώμα πρέπει να ΜΠΟΡΕΙ να αλλάξει κάτι και ο ελεγκτής έντασης να ΜΠΟΡΕΙ να πει όχι, αλλιώς έγινε σιωπηλά no-op και η πύλη θα έδειχνε πράσινη.',
    protects: 'Η αλλαγή στην ΠΗΓΗ της διεύθυνσης είναι εξ ορισμού αόρατη σε κάθε άλλη πύλη του repo: το validateWindExposureGroundTruth.mjs δίνει το ίδιο τον τομέα σε κάθε περίπτωσή του, το validateCardVsPinExposure.mjs φτιάχνει δικό του συνθετικό άνεμο, και ολόκληρη η σουίτα σεναρίων δίνει τον δικό της — αυτό ακριβώς ονομάζει το σχόλιο στο openMeteoProvider.ts ως λόγο που το cell_selection=sea δεν μπήκε ποτέ στα δύο αιτήματα πρόγνωσης. Το μετρημένο αποτύπωμα (PORISMA §Γ37, 181.575 ωροπαραλίες) είναι 34,6% αλλαγή τομέα, 17,3% λέξης, 3,9% χρώματος και 7,9% μοντελοποιημένου κύματος, με τις μισές αλλαγές προς τα πιο ΑΝΟΙΧΤΑ — δηλαδή ένα λάθος εδώ δεν χτυπάει καμπανάκι, βάφει σιωπηλά μπλε.',
    failureAction: 'Αν έπεσε το Α, ο ψημένος χάρτης έχει μπαγιατέψει: ξαναψήσ᾽ τον με `npm run bake:sea-cells` — ΜΗΝ χαλαρώσεις την πύλη για να περάσει. Αν έπεσε το Β, κάποιος έβαλε το στρώμα να πειράζει και την ΤΑΧΥΤΗΤΑ: το §Γ29 μέτρησε ότι η θάλασσα ΧΑΝΕΙ εκεί σε δύο ανεξάρτητα παράθυρα, και κάτω από 3 χλμ χάνει σταθερά. Αν έπεσε το Γ, η έκπτωση των ~30% των κλήσεων χάθηκε και μαζί ο λόγος που ο Μίλτος ενέκρινε τη δουλειά. Αν έπεσε το Δ, η κάρτα και η πινέζα διαβάζουν πια άλλη διεύθυνση για την ίδια ώρα — το ακριβές λάθος που κυνήγησε το §Γ27.',
    command: process.execPath,
    args: ['scripts/validateOverWaterWindLayer.mjs'],
  },
  {
    id: 'card-vs-pin-exposure',
    title: 'Η πινέζα δεν υπόσχεται περισσότερη προστασία απ᾽ όση λέει η κάρτα της',
    description: 'Τρέχει ΧΩΡΙΣΤΑ τις δύο πραγματικές μηχανές έκθεσης — assessBeachWindExposure (κάρτα, καρτέλα, βαθμολογία) και getVisibleMapExposureLevel (πινέζα) — πάνω σε κάθε παραλία της χώρας, σε 8 τομείς × 4 εντάσεις, χωρίς καμία κλήση πρόγνωσης. Πέντε ισχυρισμοί: (Α) η μηχανή του χάρτη μόνη της δεν βγάζει ποτέ πινέζα πιο αισιόδοξη από την κάρτα, με 9 γνωστές εξαιρέσεις καταγεγραμμένες ονομαστικά· (Β) ούτε το πέρασμα γειτονιάς το κάνει εκεί που ΑΛΛΑΖΕΙ ΧΡΩΜΑ — 5 γνωστές παραλίες, ενώ οι 280 αόρατες στη σκάλα χρώματος μετριούνται και τυπώνονται· (Γ) η νόμιμη αντίθετη κατεύθυνση (πινέζα πιο κόκκινη, 2.083 περιπτώσεις) πρέπει να ΥΠΑΡΧΕΙ, αλλιώς κάποιος έσφιξε τον κανόνα σε ισότητα και η πύλη δείχνει υγιέστερη ενώ ο χάρτης έχασε τη συντηρητική του άκρη· (Δ) οι δύο μηχανές πρέπει να μπορούν να διαφωνήσουν σε ένα καρφωτό παράδειγμα· (Ε) καταχώρηση που δεν παραβιάζεται πια είναι αποτυχία, ώστε ο κατάλογος να αδειάζει καθώς διορθώνονται.',
    protects: 'Η λέξη στην κάρτα και το χρώμα της πινέζας βγαίνουν από δύο διαφορετικές μηχανές, και μέχρι τις 20/08/2026 ΚΑΜΙΑ πύλη δεν τις αντιπαρέβαλλε: το quality:verdicts περνάει το ΙΔΙΟ exposureLevel και στα δύο σκέλη (validateVerdictConsistency.mjs:320-321), άρα είναι τυφλό εξ ορισμού σε κάθε διαφορά τους — γι᾽ αυτό η διαρροή της curated παράκαμψης στο κύμα έμεινε δεκαπέντε μέρες αόρατη. Η πρώτη εθνική μέτρηση με αυτή την πύλη βρήκε 89 πινέζες σε 11 παραλίες που βάφονται πιο ΗΡΕΜΑ απ᾽ ό,τι λέει η ίδια τους η κάρτα, επειδή ένας curated γείτονας τους δανείζει προστασία μέσω hasCuratedSegmentProtectionSupport — ανάμεσά τους ο Άγιος Ιωάννης Λευκάδας, η Φτελιά Μυκόνου και η Μικρή Βίγλα Νάξου, τρία από τα γνωστότερα σημεία kitesurf της χώρας. Η διαρροή σε γείτονες ήταν γνωστός κίνδυνος από 17/08 (§Γ15)· ότι φτάνει ως το χρώμα δεν το είχε μετρήσει κανείς.',
    failureAction: 'ΜΗΝ προσθέσεις γραμμή στον κατάλογο για να περάσει η πύλη — ο κατάλογος είναι φωτογραφία της 20/08/2026 και μόνο ΜΙΚΡΑΙΝΕΙ. Νέα παραβίαση σημαίνει ότι μια αλλαγή σου έβαλε τον χάρτη να λέει κάτι πιο αισιόδοξο από την κάρτα του: διόρθωσε την αιτία. Θυμήσου ότι η ΑΝΤΙΘΕΤΗ κατεύθυνση (πινέζα πιο κόκκινη) είναι σκόπιμη και τεκμηριωμένη στο mapExposure.ts:384-389 — μην τη «διορθώσεις» σε ισότητα, ο έλεγχος Γ υπάρχει ακριβώς για να σε σταματήσει. Αν έπεσε το Δ, κάποιος έκανε την πινέζα να επιστρέφει αυτούσιο το exposureLevel της κάρτας, δηλαδή ξανάφτιαξε την τύφλωση του quality:verdicts.',
    command: process.execPath,
    args: ['scripts/validateCardVsPinExposure.mjs'],
  },
  {
    id: 'offshore-exposed-cards',
    title: 'Η «Εκτεθειμένη» με τον αέρα από τη στεριά μόνο μικραίνει',
    description: 'Τρέχει την πραγματική μηχανή της κάρτας πάνω σε κάθε παραλία της χώρας, 8 τομείς × 4 εντάσεις χωρίς καμία κλήση πρόγνωσης, και μετράει πόσες φορές βγαίνει «Εκτεθειμένη» σε τομέα όπου η αποθηκευμένη γεωμετρία λέει ότι ο άνεμος ΦΕΥΓΕΙ από τη στεριά (onshore < -0,3). Τρεις ισχυρισμοί: (Α) το πλήθος δεν ξεπερνά τη βάση των 51 τομέων σε 40 παραλίες — καστάνια, επιτρέπεται μόνο να πέσει· (Β) η σημαία knownWindSportSpot έμεινε κατευθυντική, δηλαδή κανένας απόγειος τομέας δεν λέει «Εκτεθειμένη» εξαιτίας της· (Γ) αυτοσαμποτάζ: αν η μηχανή πάψει να βγάζει «Εκτεθειμένη» πουθενά, ο απόγειος αριθμός πέφτει στο μηδέν και η πύλη θα έδειχνε υγιέστερη ενώ έχει τυφλωθεί — απαιτούνται χιλιάδες «Εκτεθειμένη» συνολικά.',
    protects: 'Στις 20/08/2026 μετρήθηκε εθνικά ότι 118 τομείς σε 59 παραλίες έλεγαν στον κόσμο «Εκτεθειμένη» ενώ ο άνεμος έφευγε προς τη θάλασσα (PORISMA §Γ28). Οι 67 από αυτούς, σε 23 παραλίες, οφείλονταν στη σημαία knownWindSportSpot που γύριζε exposed χωρίς να κοιτάξει κατεύθυνση — Πρασονήσι, Κουρεμένος, Βασιλική, Φτελιά, Μικρή Βίγλα, Χρυσή Ακτή Πάρου — και διορθώθηκαν (§Γ28β). Οι υπόλοιποι 51 σε 40 παραλίες μένουν επίτηδες: εκεί ο χειρόγραφος προσανατολισμός και ο μετρημένος διαφωνούν 45°-140° και κανένα δεδομένο του repo δεν κρίνει ποιος δείχνει λάθος πλευρά — δύο ανεξάρτητοι μάρτυρες δοκιμάστηκαν και ψήφισαν ΑΝΤΙΘΕΤΑ, 29 έναντι 11 (§Γ28δ). Ώσπου να επαληθευτούν στο έδαφος, η συντηρητική λέξη μένει και η πύλη φυλάει να μη μεγαλώσει ο αριθμός.',
    failureAction: 'ΜΗΝ ανεβάσεις τα BASELINE_SECTORS/BASELINE_BEACHES για να περάσει — ο αριθμός επιτρέπεται μόνο να πέφτει. Αν έπεσε το Α, μια αλλαγή σου έκανε ξανά ακατεύθυντο κάποιον κανόνα έκθεσης ή πρόσθεσε χειρόγραφους exposedToWindDirections πάνω σε γεωμετρία που τους διαψεύδει: βρες την αιτία. Αν έπεσε το Β, κάποιος ξαναέκανε τη σημαία knownWindSportSpot να αγνοεί την κατεύθυνση (windExposureEngine.isKnownWindSportRisk). Αν έπεσε το Γ, δεν γιατρεύτηκε τίποτα — έσπασε το φόρτωμα δεδομένων ή η υπογραφή της μηχανής. Αν ο αριθμός ΕΠΕΣΕ νόμιμα, κατέβασε τη βάση στη νέα τιμή ώστε να μην μπορεί να ξαναανέβει.',
    command: process.execPath,
    args: ['scripts/validateOffshoreExposedCards.mjs'],
  },
  {
    id: 'marine-cell-trust-ledger',
    title: 'Η σήμανση «αυτή η παραλία διαβάζει ξένο νερό» δεν ξεθωριάζει σιωπηλά',
    description: 'Συγκρίνει, ΧΩΡΙΣ δίκτυο, δύο πράγματα που είναι και τα δύο στο repo: το κατάστιχο της τελευταίας εθνικής μέτρησης (reports/quality/marine-cell-trust-per-beach.json) και τη σημαία marineCellTrusted μέσα στα προφίλ γεωμετρίας. Τέσσερις ισχυρισμοί: (Α) καμία παραλία δεν υπάρχει στα δεδομένα χωρίς να έχει περάσει ποτέ από τον έλεγχο· (Β) σήμανση και μέτρηση συμφωνούν παραλία-παραλία· (Γ) οι αναξιόπιστες δεν ξεπερνούν τη βάση των 255 — καστάνια, επιτρέπεται μόνο να πέσει· (Δ) σαμποτάρει το ίδιο του το κατάστιχο και απαιτεί να το πιάσει ο έλεγχος Β.',
    protects: 'Οι 255 από 2.872 παραλίες (8,9%) παίρνουν ύψος κύματος από κελί μοντέλου που περιγράφει νερό το οποίο δεν βλέπουν — πίσω από ακρωτήρι ή δεκάδες χιλιόμετρα μακριά (χειρότερο: #291 Πόρτο Πεύκο, κελί 104 χλμ. μακριά). Απόφαση Μίλτου 17/08/2026, δρόμος Γ του HANDOVER-marine-cell-trust: ΔΕΝ κρύβουμε τον αριθμό, γιατί θα σβήναμε 255 πιθανώς σωστές απαντήσεις για άγνωστο πλήθος λαθών — με κυψέλες 4-8 χλμ. δεν υπάρχει κριτής που να αποδείξει λάθος σε κόλπο 2 χλμ. Τον σημαδεύουμε όμως, ώστε να σταματήσει να χειροτερεύει. Η σημαία ζει μέσα στα προφίλ γεωμετρίας, που ξαναγράφονται από εθνικά rebuild: η ίδια οικογένεια σφάλματος έχει ήδη χτυπήσει δύο φορές (σημεία θάλασσας που «σβήνονταν στο rebuild», και η Αιγιάλη που μπήκε χωρίς σφραγισμένη κυψέλη πρόγνωσης).',
    failureAction: 'Τρέξε `node scripts/auditMarineCellTrust.mjs --apply` για να ξαναμετρηθεί και να ξαναμπεί η σήμανση. ΠΟΤΕ μην ανεβάσεις το UNTRUSTED_BASELINE για να περάσει η πύλη: ο αριθμός επιτρέπεται μόνο να πέφτει, και μια αύξηση σημαίνει ότι κάτι μετακίνησε σημεία θάλασσας ή ότι μπήκαν παραλίες σε κακή θέση. Και μη σβήσεις τη σημαία για να «καθαρίσουν» τα δεδομένα — κανένας κώδικας εκτέλεσης δεν τη διαβάζει, άρα δεν βαραίνει τίποτα στην οθόνη.',
    command: process.execPath,
    args: ['scripts/validateMarineCellTrustLedger.mjs'],
  },
  {
    id: 'conditions-feel-phrase',
    title: 'The card\'s plain-words line agrees with its own numbers',
    description: 'Drives every wind × wave × language combination through the card\'s one-line description and checks four things: it fits two lines on a 320 px phone, the words match the metre figure printed directly underneath them, no verdict word ("ideal", "avoid") can enter a line that is meant to describe rather than judge, and the relief connective ("but") stops at 5 Bft so a red-pinned beach never reads like good news. Also re-checks the top band still shares its exact wording with the map legend in all five languages.',
    protects: 'Prevents the two numbers on the card («5 Μπφ | ~0,1 μ.») from meaning nothing to the reader, and the sentence that translates them from contradicting them. Twice in 24 hours (13/08, 14/08/2026) a correct description beside a correct number was clipped on a phone, and the earlier defect class is worse: a word that describes the OPEN sea sitting above a shore figure would print «big waves» over «~0,1 μ.».',
    failureAction: 'Fix utils/conditionsFeelPhrase — shorten the wording or realign the threshold the gate names. Never let the phrase read a different wave figure from the one the card prints, and never add a suitability word: the map is the only surface allowed to judge a beach.',
    command: process.execPath,
    args: ['scripts/validateConditionsFeelPhrase.mjs'],
  },
  {
    id: 'calm-water-filter',
    title: 'Το φίλτρο «Ήρεμο νερό» δεν βγάζει ποτέ άδειο, άχρηστο ή επικίνδυνο αποτέλεσμα',
    description: 'Τρέχει την ΑΛΗΘΙΝΗ `resolveCalmWaterState` (utils/calmWaterFilter) σε 8 κατασκευασμένα σενάρια που τρέχουν πάντα, και — όταν υπάρχει το εθνικό δείγμα στο .tmp — στις 550 σκηνές (110 περιοχές × 5 μέρες). Τέσσερις ισχυρισμοί: (Α) όποτε προσφέρεται το chip, ο αριθμός του είναι >0 και <όλες, και η λίστα του έχει ακριβώς τόσα μέλη· (Β) καμία παραλία με `avoid_swimming` ή απόγειο-γυαλί δεν μπαίνει ποτέ μέσα, και καμία με κύμα ≥0,4 μ.· (Γ) κάτω από 3 Μποφόρ το chip σιωπά, και σιωπά ΓΙ᾿ ΑΥΤΟΝ τον λόγο· (Δ) προσφέρεται σε ≥20% των σκηνών, αλλιώς είναι νεκρός κώδικας.',
    protects: 'Το «Ήρεμο νερό» είναι το ΠΡΩΤΟ φίλτρο του site που αλλάζει με την ώρα — όλα τα άλλα ρωτάνε τι ΕΙΝΑΙ η παραλία (άμμος, ξαπλώστρες) και μένουν σταθερά. Ο επισκέπτης το ανάβει στις 14:00 και σύρει τη μπάρα στις 19:00: χωρίς αυτούς τους ισχυρισμούς κοιτάζει άδεια λίστα, ή κουμπί αναμμένο που δεν αφαιρεί τίποτα. Και επειδή είναι ΠΡΟΟΡΙΣΜΟΣ και όχι σχόλιο, μια παραλία που η ίδια η εφαρμογή λέει «μην μπεις» δεν επιτρέπεται να μπει επειδή έτυχε να έχει χαμηλό κύμα. Μετρημένο πριν γραφτεί: μέσα στις ΚΟΚΚΙΝΕΣ μόνο 6 στις 602 έχουν ήρεμο νερό (1%) — γι᾿ αυτό το φίλτρο κάθεται ΠΑΝΩ από τις ομάδες χρώματος και είναι αμοιβαία αποκλειόμενο με αυτές.',
    failureAction: 'Διόρθωσε το utils/calmWaterFilter — ΠΟΤΕ την πύλη. Οι δύο έλεγχοι ασφαλείας (avoid_swimming, offshoreFlatWater) είναι μονόδρομοι: μπορούν να βγάλουν παραλία από την προσφορά, ποτέ να προσθέσουν. Αν πέσει το Δ, το feature δεν είναι πια ορατό σε αρκετές οθόνες ώστε να αξίζει τον χώρο του — αυτό είναι απόφαση προϊόντος, όχι κατώφλι να ανέβει.',
    command: process.execPath,
    args: ['scripts/validateCalmWaterFilter.mjs'],
  },
  {
    id: 'access-reason-copy',
    title: 'The access caption describes the beach it is sitting on',
    description: 'Runs the REAL access predicate (utils/access.getHardAccessKind) and the REAL sentences (utils/accessReasonCopy) over every beach in the country in all five languages, and asserts four things: the word "boat" reaches only beaches that actually need one; an unpaved road is called unpaved and a walk is called a walk; no caption describes OUR list or ranking instead of the beach; and an unchecked road stays silent. Refuses to pass if any bucket is empty. Self-proves with --prove: routing everything to the boat sentence, letting the dirt caption talk about our ranking, and breaking the unknown bucket\'s silence must each make it fail.',
    protects: 'Prevents the page telling visitors a beach needs a boat or a hard path when it does not. Until 14/08/2026 there was ONE caption for every beach that is not plain asphalt — «Θέλει σκάφος ή δύσκολο μονοπάτι» — while the filter behind it also excluded dirt roads, easy walks, unknown road types and anything remote: 1.000 of the 1.380 beaches carrying it needed neither a boat nor a hard path, urban beaches among them. It survived for months because the sentence lived inside a 5.000-line component where no gate could read it.',
    failureAction: 'Fix utils/accessReasonCopy or the bucket in utils/access.getHardAccessKind that the failure names. Never widen a sentence to cover a bucket it does not describe, and never move these strings back into a component — the gate can only see them while they live in their own file.',
    command: process.execPath,
    args: ['scripts/validateAccessReasonCopy.mjs', '--prove'],
  },
  {
    id: 'access-notes-provenance',
    title: 'Η χειρόγραφη παράγραφος πρόσβασης περιγράφει τη δική της παραλία',
    description: 'Διαβάζει public/greek_beaches.json — την πηγή, όχι το χτισμένο tier — και ελέγχει ότι καμία μη-βοηθητική παράγραφος metadata.access.notes δεν επαναλαμβάνεται byte-for-byte σε παραλία ΑΛΛΗΣ περιοχής. Οι γνωστές γενικές ετικέτες προέλευσης (OSM/Seatrac/η φόρμουλα εδάφους) επιτρέπονται ρητά — δεν κατονομάζουν ποτέ τόπο. Self-proves με --prove: δύο κατασκευασμένες παραλίες διαφορετικής περιοχής με το ίδιο κείμενο πρέπει να πιαστούν.',
    protects: 'Το `metadata.access.notes` είναι ελεύθερο κείμενο γραμμένο ένα-ένα ανά παραλία, και το BeachCard το τυπώνει αυτολεξεί στους Έλληνες επισκέπτες (οι άλλες γλώσσες πέφτουν στην ετικέτα). Βρέθηκε δύο φορές μέσα σε δύο μέρες: εννιά παραλίες μοιράζονταν την παράγραφο του Σχινιά (14/08, οκτώ κρητικές), και το πρώτο τρέξιμο αυτής της ίδιας πύλης (16/08) έπιασε την Παραλία Κοκολόκο (Αττική) να περιγράφει την παραλία Κεφάλα (Νότια Εύβοια) — διορθώθηκε αυθημερόν. Κανένα άλλο από τα δίχτυα δεν το έβλεπε, γιατί όλα ρωτάνε «είναι αλήθεια αυτό που λέμε;» και αυτό εδώ είναι «λέμε για ΑΛΛΗ παραλία».',
    failureAction: 'Άνοιξε το public/greek_beaches.json στη γραμμή που δείχνει η πύλη και αντικατέστησε το κείμενο με ό,τι λέει ήδη το δικό της access.type (βλ. scripts/fixKokolokoAccessContamination2026-08.mjs για το πρότυπο). Μην το διαγράψεις — parseBeachPayload απαιτεί string και πετάει όλο το metadata αν λείπει. Μετά: npm run build:beach-data.',
    command: process.execPath,
    args: ['scripts/validateAccessNotesProvenance.mjs', '--prove'],
  },
  {
    id: 'shoreline-segment-geometry',
    title: 'Οι χειροκίνητες ομάδες «ίδια ακτή» συμφωνούν με τη μετρημένη γεωμετρία',
    description: 'Δύο έλεγχοι πάνω στις 64 ομάδες που δηλώνουν «αυτές οι παραλίες είναι το ίδιο κομμάτι ακτής». ΔΟΜΙΚΑ: καμία ομάδα δεν έχει μέλη που κοιτάνε πάνω από 65° διαφορετικά — η ίδια ανοχή που χρησιμοποιεί ο κώδικας του χάρτη — ώστε η λάθος ομάδα να πιάνεται ΠΡΙΝ βγάλει λάθος χρώμα. ΣΥΜΠΕΡΙΦΟΡΑ: τρέχει τον ΑΛΗΘΙΝΟ resolver του χάρτη σε 5 σενάρια ανέμου × 13 νησιά και απαιτεί κάθε αντίφαση χρώματος μέσα σε ομάδα να είναι γραμμένη απόφαση στο ACCEPTED_CONTRADICTIONS, με το μετρημένο εύρος δίπλα. Η λίστα δεν επιτρέπεται να σαπίσει: αποδεκτή που έπαψε να εμφανίζεται ρίχνει την πύλη. Self-proves με --prove: κατεβάζει το όριο στις 5° και πρέπει να αποτύχει.',
    protects: 'Η ομάδα ΔΕΝ είναι διακοσμητική: το hasCuratedSegmentProtectionSupport δίνει «προστατευμένη» σε παραλία χωρίς δική της γεωμετρική προστασία, επειδή την έχει ομαδάρχισσά της — παρακάμπτοντας τον έλεγχο προσανατολισμού. Οι ομάδες γράφτηκαν 09/06/2026 και ήταν σωστές· την ΕΠΟΜΕΝΗ μέρα η ακτογραμμή ξαναμετρήθηκε με λεπτομερή χάρτη OSM και Κολιτσάνι/Μυλοπότας/Βαλμάς πήγαν από εύρος 5° σε 109°. Δεν άλλαξε η ακτή — άλλαξε πόσο καλά τη μετράμε. Το λάθος έζησε ΔΥΟ ΜΗΝΕΣ και βρέθηκε κατά τύχη στον επανέλεγχο της Ίου: 23 ομάδες μοίραζαν 38 δανεικές «προστατευμένες», και οι πέντε γύριζαν παραλία που η δική της γεωμετρία λέει exposed σε protected (Πλατανιστός, Βασιλικό, Αλυκό, Μικρό Αλυκό, Πυργάκι). Είναι η σκανδάλη #1 της βίβλου §9 — ψεύτικη ηρεμία.',
    failureAction: 'Χώρισε την ομάδα, ή βάλ\' την στο RETIRED_SHORELINE_SEGMENT_IDS (utils/shorelineSegments.ts). Αν είναι γνήσια διαφωνία του μοντέλου — τα μέλη κοιτάνε το ίδιο και το χρώμα διαφέρει — γράψ\' την στο ACCEPTED_CONTRADICTIONS με το ΜΕΤΡΗΜΕΝΟ εύρος και τον λόγο. ΠΟΤΕ μην ανεβάσεις το όριο των 65°: είναι η ανοχή του ίδιου του χάρτη, και ανεβάζοντάς το επιτρέπεις σε δύο διαφορετικούς κόλπους να δανείζονται ηρεμία.',
    command: process.execPath,
    args: ['scripts/validateShorelineSegmentsGate.mjs'],
  },
  {
    id: 'condition-tone-agreement',
    title: 'One condition colour per beach',
    description: 'Sweeps 2.952 exposure/Beaufort/cove/wave/period/offshore-wind combinations through both colour resolvers — the region map pin and the card-list chip — checks the offshore-flat-water lift fires only on a protected shore at exactly 5 Bft and never escapes the sea-state ceiling, and then drives calculateBeachScore end to end to prove the scoring layer still feeds the sea state in.',
    protects: 'Prevents the card saying green while the pin beside it says orange for the same beach at the same moment. The chip was a second, older colour ladder that never read the sea at all: it disagreed with the pin on 38% of the grid, always in the optimistic direction — every shore at 0-3 Bft under a >=0,8 m sea still running (the day after a meltemi) and every protected shore at 4 Bft. It also held an enclosed cove GREEN from 5 Bft, so 1.010 beach x wind-direction combinations showed a green dot over the app\'s own avoid_swimming verdict.',
    failureAction: 'Fix utils/suitabilityTone.resolveConditionTone or whichever surface stopped reading it. Never relax a rule here to make a case pass — two independent ladders is exactly how this started.',
    command: process.execPath,
    args: ['scripts/validateConditionToneAgreement.mjs'],
  },
  {
    id: 'over-caution',
    title: 'The reverse net: never rougher than our own geometry proves',
    description: 'Every other gate asks "are we claiming calmer than the truth?". This one asks the opposite question, demanded by the PORISMA on 05/08/2026 and unpaid until 10/08: over the 2.823 beaches whose committed geometry proves flat water on a pure-offshore wind (same exported constants the shipped reliefs trust, authored human vetoes respected), it drives the REAL engine and the REAL map path and fails if the engine withholds earned protection, if the pin exceeds the deliberate per-Beaufort maximum caution (quiet sea: blue to 3 Bft, yellow to 5; running downwind sea: the yellow floor; 6 Bft: orange by decision), or — the other direction — if any relief overshoots to blue over a running sea. Self-proves: three simulated regressions (relief lost, geometry starved, ceiling deleted) must each make it fail.',
    protects: 'Prevents the app quietly frightening people away from its own best answers. On 10/08/2026 Miltos found by eye what no gate asked: 222 beaches — Σχοινιάς first, then the meltemi lee coasts of Κάρπαθος, Μύκονος, Τήνος, Μήλος — wearing a rougher colour than their own water, because the sea reading came from a sample point DOWNWIND of the shore. The over-cautious direction has no complaining user: nobody emails "I did not go and it was lovely". It only shows up as trust quietly leaking to whichever competitor says "fine" on the days we wrongly say "fair".',
    failureAction: 'Fix the surface the rule names (engine grant, pin ladder, or ceiling). Never widen this gate\'s thresholds and never shrink its class definition to make it pass — the class is built from the SAME constants the shipped reliefs trust, so weakening one weakens the other.',
    command: process.execPath,
    args: ['scripts/validateOverCaution.mjs', '--prove'],
  },
  {
    id: 'podium-sea-order',
    title: 'The podium does not rank umbrellas above the sea',
    description: "Drives the REAL prioritizeProtectedRecommendations over six fixtures and checks the order means what the heading says: a calmer sea outranks better amenities and higher recognition; a difference INSIDE the wave model's own error bar (0,25 m, the worst per-buoy RMSE we record) does not reorder anything; a lee shore ranks on its modelled height at the sand, not on the cell 9 km offshore; the map colour and the wind on that shore both still outrank the new tier; and with no sea readings at all the order is byte-identical to the old behaviour. Self-proves with --prove: the tier removed, the threshold zeroed, and the shore height ignored must each make it fail.",
    protects: 'Prevents the ladder from deciding a "where is it calm today" podium on parking and sunbeds. Measured live on 10/08/2026 in East Attica at 5 Bft: all ten candidates tied on exposure, colour, own-shore wind, recognition and access, so the comparison fell through to amenities — 22 versus 20 — and a beach scoring 58 led one scoring 76. Until this gate existed there were 33 checks on whether our claims were TRUE and none on whether the ranking meant what its own heading promises.',
    failureAction: 'Fix the tier order in services/topPickRanking.prioritizeProtectedRecommendations. Never make it pass by raising PODIUM_SEA_MEANINGFUL_DIFFERENCE_M — that number is read off reports/wave-model/buoy-comparison.json, and widening it to silence a case is how a measured constant becomes a tuned one. Never rank on BeachScore.waveHeightM: it is the display figure the cove guard rewrites.',
    command: process.execPath,
    args: ['scripts/validatePodiumSeaOrder.mjs', '--prove'],
  },
  {
    id: 'podium-list-colour-agreement',
    title: 'Βάθρο + λίστα = τα δύο καλύτερα χρώματα της λεζάντας',
    description: 'Drives the REAL selectSuitableByTone / selectSuitableToneGroups over eight region shapes — including the exact one from the 15/08/2026 screenshot — and does the subtraction the reader does: the podium plus «Υπόλοιπες» must equal the members of the two best colours PRESENT, with no beach counted twice; no podium beach may wear a worse colour than one sitting in the list beneath it; ΔΥΣΚΟΛΗ never reaches either surface; and the two-colour window must stay relative (yellow+orange where no blue exists, orange alone on a hard island) so the restriction can never empty a podium the region could fill. It also asserts the WIRING in App.tsx: both podium doors — isDirectoryTopRecommendationCandidate and isShelteredFallbackCandidate — must pass through isPodiumColourAdmissible, because the defect was one door nobody had connected. Self-proves with --prove: a colour-blind podium, a list opened to a third colour, and the wiring stripped out must each make it fail.',
    protects: 'The rule is Miltos\'s, set on 10/08/2026 and verified BY HAND across four regions — «στις τοπ 3 και στις υπόλοιπες κατάλληλες το άθροισμά τους να είναι το άθροισμα των ιδανικών και των καλών». It was written into App.tsx and into the PORISMA and never got a gate, so on 15/08/2026 it broke in silence: a region page printed «Ιδανική 1 · Καλές 16» on the map legend and «Top 1» + «Υπόλοιπες (17)» underneath — 18 beaches shown against a legend counting 17, which is only possible if the medal was on a beach outside both colours. A ΜΕΤΡΙΑ was leading sixteen ΚΑΛΕΣ while the single ΙΔΑΝΙΚΗ sat in the list below. None of the other 40 checks noticed, because none of them did the arithmetic the reader does.',
    failureAction: 'Fix the source that let a foreign colour in — normally a podium pool that skipped isPodiumColourAdmissible (App.tsx), not the gate. Never make it pass by widening SUITABLE_LIST_TONE_GROUPS: that number is the promise the legend makes, and raising it changes what «κατάλληλες» means on every region page. Never make it pass by dropping the podium from the subtraction — «Υπόλοιπες» meaning «the rest» is a decision of 11/08/2026.',
    command: process.execPath,
    args: ['scripts/validatePodiumListColourAgreement.mjs', '--prove'],
  },
  {
    id: 'top-pick-score-table',
    title: 'Ο πίνακας των 100 λέει αυτό που υπόσχεται',
    description: 'Drives the REAL weighted table: the weights sum to 100 and split 80 weather / 20 comfort, with the human block asserted SMALLER than the smallest weather axis so umbrellas can never outrank the sea; the region podium is proved blind to the visitor\'s location — a beach 2 km away and one 240 km away, identical in everything else, rank in the order they arrived; through the real ranking, at 3, 4 and 5 Bft a beach with perfect access, full amenities and the best crowd tier can never beat a bare protected one, while on a 2 Bft day it must (there is no wind to be sheltered from); two sea heights inside the model\'s error bar score identically and SEA_STEP_M still equals PODIUM_SEA_MEANINGFUL_DIFFERENCE_M; a beach with no wave, no exposure verdict and no crowd tier scores in the middle rather than at the floor; no crowd tier ever adds points or removes more than 5; and across every region holding a paid beach, at every wind state, none reaches a Top 3. Self-proves with --prove: comfort raised to 50, the sea step made continuous, missing data scored zero, and the crowd penalty flipped to a bonus must each make it fail.',
    protects: 'On 10/08/2026 the podium stopped being a lexicographic ladder and became one weighted score, on Miltos\'s instruction. Measured over 110 regions × 8 wind sectors × 4 Beaufort: the #1 pick changes in 50,0% of cases and the full Top 3 in 69,4%. A weighted sum introduces a failure a ladder could not have — comfort accumulating past weather — and nothing downstream can see it, because the ranking is the last word and a wrong weight looks exactly like a right one. The paid-entry door is asserted here too: the flag had been collected and shown on cards since launch, but no ranking file read it, and 32 podiums in the national sweep contained a beach you pay to enter.',
    failureAction: 'Fix utils/topPickScoreTable.ts, or — for the location assertion — services/topPickRanking.ts, where `distanceKm: undefined` is deliberate and must not be "restored" to read item.distance. Never rebalance the weights to make a case pass — the 80/20 split is a product decision recorded in the status board, and moving it silently re-weights every recommendation on the site. In particular, growing the human block past the smallest weather axis is the mistake 11/08 made and measured: it lets a running sea with sunbeds outrank a calm shore without. Never make an axis continuous to "break more ties": a tie means the evidence genuinely cannot separate two beaches.',
    command: process.execPath,
    args: ['scripts/validateTopPickScoreTable.mjs', '--prove'],
  },
  {
    id: 'presumed-quiet',
    title: '"Little known" never lands on a beach we simply failed to look up',
    description: 'Checks the 569 beaches the «Ήσυχη» filter now includes on inference rather than measurement: none is on the curated famous list, none carries a Google crowd tier, none is organized or has a bar or sunbeds, none sits inside a big city\'s radius, every quiet flag says how it was reached, and the inferred badge uses different words from the counted one in all five languages. Self-proves with --prove: a famous, a counted, a beach-bar and an urban beach each marked presumed must each make it fail.',
    protects: 'The «Ήσυχη» filter used to need a Google review count, so it could only ever see the 1.986 beaches with a verified Place ID — the 871 emptiest stretches of coast were missing from the one filter built to find them. Letting them in means publishing a claim about crowds we did not measure, and nothing downstream can catch a mistake here: the contradicting data is exactly what we lack. Measured on 10/08/2026: without the famous-beach gate, Ναυάγιο, Σαρακήνικο, Εγκρεμνοί, Σεϊτάν Λιμάνι, Κλέφτικο, Λαλάρια and Πισίνα would all have been published as little known, because their names collide nationally and the Place ID resolver refused to guess.',
    failureAction: 'Fix the three gates in scripts/buildBeachRegionData.mjs (developed / famous / urban) and rebuild with "npm run build:beach-data". Never widen the inference to make a case pass, and never let the presumed badge borrow the counted wording — the whole safety of this feature is that an inference is visibly an inference.',
    command: process.execPath,
    args: ['scripts/validatePresumedQuiet.mjs', '--prove'],
  },
  {
    id: 'stay-window-worst-hour',
    title: 'A stay is judged by its roughest hour',
    description: 'Drives utils/stayWindow over all 1.364 tone sequences a sampled window can have (1-5 hours × 4 colours) and checks the hour chosen to speak for the window is always the roughest one in it, that ties fall to the earliest hour so an unchanging day behaves exactly as before, that no stay still means exactly one slot, and that both ends of the window are always sampled. Then re-runs the whole grid against two deliberately wrong pickers and fails if either survives.',
    protects: 'Prevents "how long are you staying" from quietly becoming an average. A visitor staying 11:00-19:00 on a day that goes to 6 Bft at 17:00 has an afternoon the mean of the day calls fine — and averaging is the one direction this project has decided it will not fail in. Measured before the feature was built (scripts/measureIntradayWindowSpread.mjs, 05/08/2026, 2.922 beach-days): on 33,0% of them the day turns rougher than the hour the visitor arrives in, so this is the common case, not the corner case.',
    failureAction: 'Fix utils/stayWindow.pickHarshestStayHour. Never soften the rule to make a case pass: if the window\'s answer is allowed to be calmer than one of its hours, the feature is telling people the sea is quieter than it will be.',
    command: process.execPath,
    args: ['scripts/validateStayWindow.mjs'],
  },
  {
    id: 'summary-tier-can-answer',
    title: 'Every region can still answer "where should we go"',
    description: 'Reads all 110 summary-tier region files — the data the map, the cards and the podium actually run on — and applies the same static-data half of the top-pick trust gate the app applies, then checks that regions able to produce an answer have not collapsed wholesale, and that terrain.types is not lost between the raw dataset and the tier. Self-proves with --prove: stripping terrain in memory must make it fail.',
    protects: 'On 09/08/2026 the region podium — the «Πού να πάμε τώρα;» block, the one thing the product exists to answer — was found rendering for NOBODY, in all 110 regions, every day. Corfu offered 105 candidates and 0 survived. The summary tier carries a deliberately trimmed metadata and the trim dropped metadata.terrain.types, which hasTrustedTopPickStaticData requires; every beach failed that single check while passing confidence, access, profile, depth, orientation and wind evidence. None of the 31 existing gates saw it, because every one of them asks "is what we say true?" and this was "we say nothing at all". This gate asks the other question.',
    failureAction: 'Do NOT relax the trust gate to make this pass — it would relax on the detail tier too, where the data is real. Fix buildSummaryBeach in scripts/buildBeachRegionData.mjs to carry the field the gate reads, and re-run npm run build:beach-data.',
    command: process.execPath,
    args: ['scripts/validateSummaryTierAnswers.mjs', '--prove'],
  },
  {
    id: 'beach-page-contradictions',
    title: 'What the user actually sees',
    description: 'Opens four real Ios beach pages in a browser against a fixed 5 Bft northerly and checks each one states how that wind meets ITS shore — lee, side-on or head-on — matching the beach\'s own committed geometry, and that a lee shore and a windward shore on the same island never read the same.',
    protects: 'The only gate in the repo that opens a page. Every other check reasons about numbers, and both defects reported on 29/07/2026 were found by a human looking at a screen while fourteen gates were green. It is joining this set on 02/08/2026 because it had been RED for three days without anyone noticing: it lived only behind `npm run quality:page`, and three of the strings it scraped had been intentionally renamed or removed underneath it. A check nobody runs is a check that goes stale, and a stale check teaches people to ignore red.',
    failureAction: 'Read the printed table first: it says what the geometry expects and what the page actually read. If the page says nothing, the explanation sentence has been lost from the hero — that has happened before (twice, silently). If the wording merely changed, update the phrase lists at the top of the script; never delete a rule to make it pass.',
    command: process.execPath,
    args: ['scripts/validateBeachPageContradictions.mjs'],
  },
  {
    id: 'tile-fit',
    title: 'No tile or tab clips a word, and every tab lands',
    description: 'Opens the answer card at 320 / 360 / 390 / 430 px in all five languages and measures every text node inside a tile — 400 measurements, none of which may be cut off horizontally — then does the same for the fixed bottom bar, where navigation and up to three jump tabs share one row: no clipped label, no row wider than the viewport, no control under 44 px. Finally it CLICKS each tab and checks the section it jumps to lands clear of the sticky header and takes keyboard focus with it.',
    protects: 'The eight tiles are the whole card, and on a 320 px phone each one gets about 66 px. A long word does not wrap — it is simply cut, and the reader is handed half a fact («Με αυτοκίν…»). BeachAnswerHero.tsx has carried a comment describing exactly this measurement, and the `data-tilefit` attributes it was run against, since the day the card was built — but the probe was never committed, so for weeks nothing enforced it. When it was finally written down (05/08/2026) it immediately found three words still being cut, in Greek and German, that no one had seen.',
    failureAction: 'For a tile: fix it with the levers the card already uses below 380 px — side padding and one step of font size — never by shortening the copy and never by letting words break mid-syllable (a broken Greek word reads as a typo, which is why [word-break:normal] is set explicitly). If a language needs a shorter label, change that label, not the rule. For a bar tab: shorten that language\'s tabWave/tabStory/tabNearby string — the tab carries an icon and is allowed to be shorter than the heading it lands on. For a failed landing: the scroll-mt on the three jump targets in BeachDetailPage must clear the sticky header, which was 77 px when this was written; if the header grew, grow the margin.',
    command: process.execPath,
    args: ['scripts/validateTileFit.mjs'],
  },
  {
    id: 'analytics-guards',
    title: 'The counter only counts our own visitors',
    description: 'Drives the two abuse guards on /api/hit directly — same-origin (including deploy previews, lookalike domains and the Origin-beats-Referer rule) and the per-IP burst limit — plus the POST-only restriction on the handler.',
    protects: 'The FIRST gate that ever opened a Netlify function. Nothing else covers them: no build step, no type check, no test — they ship straight to production on push. On 02/08/2026 /api/hit reported 6.937 unique visitors and 1.008 new for a day GA4 measured at 82 users, because uniqueness is ip+UA+day and the caller picks the UA. It drives the PREDICATES, not the handler, on purpose: the handler answers 204 for accepted, refused and storage-error alike so a probing script learns nothing — which also means a handler-level test passes with both guards deleted.',
    failureAction: 'Restore the guard the gate names in netlify/functions/pageview.mjs. Never loosen the host check to a suffix match — «calmbeach.gr.evil.example» ends with our domain. And never let the burst limit be shared across IPs: one attacker would mute everyone else\'s analytics.',
    command: process.execPath,
    args: ['scripts/validateAnalyticsGuards.mjs'],
  },
  {
    id: 'wave-climatology',
    title: 'Guide climatology vs beach pages',
    description: 'Compares the wave thresholds and the swell-equivalent formula between utils/waveCharacter.ts and the Python that builds data/waveClimatology.generated.json, proves the four honesty rules of utils/seaSeasonProfile.mjs by driving them backwards (including that the source line says we compute the figure, not that Copernicus hands it to us), and reads the prerender call site to confirm it passes beach IDS and the loaded climatology.',
    protects: 'Prevents the intent guides from saying "usually calm" about a beach whose own page paints it orange. The number in the guide comes from a separate Python program that copies the app thresholds, so one edit to SEA_STATE_AMBER_M would desync hundreds of articles with nothing throwing. It also blocks a monthly AVERAGE from being phrased as a percentage of days — an invented figure in convincing clothing — and stops the Ionian guides claiming a Meltemi that does not blow there.',
    failureAction: 'Realign the constants in scripts/buildWaveClimatology.py with utils/waveCharacter.ts, or fix the prerender call site. Never widen a range in the gate to make the generated file pass — regenerate the file instead.',
    command: process.execPath,
    args: ['scripts/validateWaveClimatology.mjs'],
  },
  {
    id: 'water-climatology',
    title: 'Guide water temperature vs the beach page',
    description: 'Checks the cold/mild/ideal thresholds AND their open ends agree across the three places that hold them — utils/waterTemperatureCopy.ts (the single source the beach page AND the card now read), the Python that builds the data, and utils/waterSeasonProfile.mjs — that the guide uses the same five-language words those surfaces print, that neither the page nor the card has quietly re-written the thresholds locally, and that the prerender passes beach IDs and the WATER file rather than the wave one.',
    protects: 'Prevents a guide saying the sea is "ideal" in a month whose own beach page calls it "mild". The page treats 24.0 C as mild and only above 24 as ideal; the first Python copy used >= and misclassified 164 months with nothing throwing. It also blocks the wave/water file mix-up, which differs by one letter and would make the paragraph vanish silently, and stops a monthly average being dressed up as something measured at the shoreline.',
    failureAction: 'Realign the thresholds in scripts/buildWaterClimatology.py and utils/waterSeasonProfile.mjs with pages/BeachDetailPage.tsx, or fix the prerender call site. Regenerate the data file rather than widening a range in the gate.',
    command: process.execPath,
    args: ['scripts/validateWaterClimatology.mjs'],
  },
  {
    id: 'beach-name-search',
    title: 'Κάθε παραλία βρίσκεται με το όνομά της',
    description: 'Ρωτάει τον πραγματικό μηχανισμό αναζήτησης (utils/searchNormalize.ts) για καθεμία από τις 2.873 παραλίες, γραμμένη με τέσσερις τρόπους: ελληνικά, το αγγλικό της όνομα, φωνητικά λατινικά («Parikia») και γράμμα-γράμμα λατινικά όπως το γράφει το Google Maps («Paroikia»). Δίνει μόνο τα δύο ονόματα της παραλίας, χωρίς τα εναλλακτικά που δίνει η εφαρμογή, άρα είναι αυστηρότερη από την πραγματικότητα. Συνοδεύεται από καρφωτά ζεύγη και από τρια ζεύγη που ΔΕΝ επιτρέπεται να ταιριάξουν, ώστε να μην περνάει με έναν μηχανισμό που λέει «ναι» σε όλα.',
    protects: 'Εμποδίζει το «τη δείχνει ο χάρτης, δεν τη βρίσκει η αναζήτηση». Μέχρι τις 22/08/2026 η αναζήτηση κρατούσε μόνο τη φωνητική λατινική γραφή, και 42 παραλίες — κάθε «Αγία Ειρήνη», κάθε «Άγιοι Ανάργυροι», κάθε «Άγιος Βασίλειος» — ήταν άφαντες για όποιον έγραφε το όνομα όπως το είδε στον χάρτη.',
    failureAction: 'Δες τους δύο πίνακες μεταγραφής στο utils/searchNormalize.ts. Ποτέ μην σβήνεις μία γραφή για να περάσει η πύλη και ποτέ μην χαλαρώνεις το κατώφλι του fuzzySearchScore — πρόσθεσε τη γραφή που λείπει.',
    command: process.execPath,
    args: ['scripts/validateBeachNameSearch.mjs'],
  },
  {
    id: 'trip-query-parsing',
    title: 'Trip query parsing',
    description: 'Parses free-text trip sentences ("θα μείνω Νάξο για 5 μέρες") over the real region list: recall in 5 languages, precision against dates/quantities/beach names with numerals, a stopword sweep, order invariance, and every region resolving from its own name.',
    protects: 'Prevents the search box from sending someone to the wrong island, inventing a day count from a date or a beach name, or matching a region on a stopword like «θα» (which scored 92 against Θάσος).',
    failureAction: 'Review utils/tripQueryParser.ts token tables and score thresholds. Never lower a threshold to make one sentence work — add the token to the tables instead.',
    command: process.execPath,
    args: ['scripts/validateTripQueryParsing.mjs'],
  },
  {
    id: 'planner-agreement',
    title: 'Trip planner agreement',
    description: 'Runs planTrip over real regions with 6-day rotating-wind forecasts: no pick outside the podium safety gate, no unbacked shelter claim, order-invariance, policy filters, Beaufort ceiling.',
    protects: 'Prevents the trip planner from naming a beach the homepage refuses, claiming shelter without evidence, or picking by JSON file order.',
    failureAction: 'Review tripPlannerService gates/ranking against services/topPickRanking and the assertions in scripts/validatePlannerAgreement.mjs.',
    command: process.execPath,
    args: ['scripts/validatePlannerAgreement.mjs', '--strict'],
  },
  {
    id: 'content-audit',
    title: 'Static content safety audit',
    description: 'Scans static copy and generated beach data for risky wording like guaranteed calm, protected, safe, ideal, or no-wave claims.',
    protects: 'Prevents static text from promising live conditions that weather data has not verified.',
    failureAction: 'Rewrite the flagged copy as cautious wording or move the claim to verified windProfile/local notes.',
    command: npmBin,
    args: ['run', 'content:audit'],
    evaluate: ({ stdout, exitCode }) => {
      if (exitCode !== 0) {
        return { ok: false, reason: `process exited with ${exitCode}` };
      }

      const match = stdout.match(/Findings:\s+\d+\s+\(high\s+(\d+),\s*medium\s+(\d+),\s*low\s+(\d+)\)/i);
      if (!match) {
        return { ok: true, reason: 'no parsable high-risk count found' };
      }

      const highCount = Number(match[1]);
      if (highCount > 0) {
        return { ok: false, reason: `content audit found ${highCount} high-risk wording finding(s)` };
      }

      return { ok: true, reason: 'no high-risk wording findings' };
    },
  },
  {
    id: 'athens-clock',
    title: 'Athens wall-clock guard',
    description: 'Scans app code for a raw new Date()/Date.now() used as "now" instead of athensNow().',
    protects: 'Prevents the viewer\'s own timezone from pointing them at the wrong forecast hour — every user must read the same Greek-time conditions.',
    failureAction: 'Use athensNow() from utils/athensTime.ts, or mark the line "athens-clock-exempt: <reason>" when it is a real instant (age, duration, id).',
    command: process.execPath,
    args: ['scripts/validateAthensClock.mjs'],
  },
  {
    id: 'capacity-ledger',
    title: 'Open-Meteo quota ledger',
    description: 'Pure-logic checks on the monthly call counter: day rollover, billing window, projection.',
    protects: 'Keeps the "how much of the 1,000,000/month is left" number honest. The counter used to hold ONE day and zero it at midnight, so nothing could tell whether the paid plan was about to run out.',
    failureAction: 'Read the failing assertion in scripts/validateCapacityLedger.mjs — it names the behaviour that broke.',
    command: process.execPath,
    args: ['scripts/validateCapacityLedger.mjs'],
  },
  {
    id: 'lint',
    title: 'TypeScript lint/typecheck',
    description: 'Runs TypeScript without emitting files.',
    protects: 'Prevents broken imports, type errors, and obvious code integration mistakes.',
    failureAction: 'Fix the TypeScript error shown in the output.',
    command: npmBin,
    args: ['run', 'lint'],
  },
  {
    id: 'build',
    title: 'Production build',
    description: 'Builds the production Vite app.',
    protects: 'Prevents deploys that compile in dev but fail in production bundling.',
    failureAction: 'Fix the build error. Existing large chunk warnings are advisory unless Vite exits non-zero.',
    command: npmBin,
    args: ['run', 'build'],
    // Build as production ON PURPOSE. The last step of `npm run build` is
    // applyDeployContextGuards.mjs, which on any non-production CONTEXT stamps
    // noindex into every page and rewrites robots.txt to `Disallow: /`. The very
    // next check in this gate — the SEO prerender audit — then fails on exactly
    // that, so the gate could never go green anywhere except a Netlify
    // production build. It reported 8 phantom failures on every local run until
    // 30/07/2026 and people learned to ignore it, which is worse than not having
    // the check. Safe: `dist/` is gitignored and Netlify builds its own copy, so
    // an index-able local dist is never published.
    env: { CONTEXT: 'production' },
  },
  {
    // MOVED HERE 09/08/2026, from third place in this list. It reads dist/ and
    // exits 1 when the directory is absent (auditLoggedOutParity.mjs:39-41), so
    // ahead of the build it passed only on a machine that happened to have a
    // dist/ lying around from an earlier run — and failed on every clean
    // checkout, including CI, for a reason that had nothing to do with the code.
    // A gate that is red for an unrelated reason is worse than no gate: it
    // teaches people to ignore red. It now sits with the other dist-readers.
    id: 'logged-out-parity',
    title: 'Signing out costs nothing',
    description: 'Checks the built output keeps the promise accounts were added on: the Supabase SDK is never preloaded by the entry HTML and is never imported statically, no account UI leaks into prerendered static content, and every visitor-contributed block carries its "from a visitor" label.',
    protects: 'Prevents the ~99% of visitors who never sign in from silently paying 57 KB gzipped for a feature they do not use — and prevents user-uploaded content from ever reading as our own measured data.',
    failureAction: 'Move the offending import behind the dynamic import in services/supabaseClient.ts, or add the locale label to the visitor block in scripts/prerenderBeachPages.mjs. Never delete the rule to make it pass.',
    command: process.execPath,
    args: ['scripts/auditLoggedOutParity.mjs'],
  },
  {
    id: 'bundle-secrets',
    title: 'Bundle secret guard',
    description: 'Checks vite.config.ts still loads only VITE_-prefixed env vars and has no `define` block injecting environment values, then scans the built bundle for key-shaped literals (Google, OpenAI, GitHub, AWS, Slack, Telegram, PEM).',
    protects: 'Prevents a server-side secret from being inlined into the JavaScript every visitor downloads. The config used to do exactly this: loadEnv with an empty prefix plus define(process.env.API_KEY) would have published GEMINI_API_KEY the first time it was set in Netlify. Nothing errors when this drifts — the key just ships.',
    failureAction: "Restore loadEnv(mode, '.', 'VITE_') and remove the define block in vite.config.ts. If a key was found in dist/, revoke it first, then find what put it there.",
    command: process.execPath,
    args: ['scripts/validateBundleSecrets.mjs'],
  },
  {
    id: 'seo-audit',
    title: 'SEO prerender audit',
    description: 'Audits generated prerendered pages, sitemap, robots.txt, canonicals, hreflang links, structured data, internal links, image references, and SEO performance budgets.',
    protects: 'Prevents broken search-indexing signals from reaching production after prerender generation.',
    failureAction: 'Fix the generated SEO output, prerender routes, metadata, hreflang/canonical links, or referenced assets reported by the audit.',
    command: npmBin,
    args: ['run', 'seo:audit'],
  },
  {
    id: 'region-pages',
    title: 'Region pages are list pages',
    description:
      'Asserts every prerendered /beaches/{region}/ page in every locale answers its own head term ("Beaches in X"): a short, non-interrogative H1 that names the region, a body thick enough to be a real list page, a link to every beach and to every guide actually built for that region, FAQPage/CollectionPage/ItemList/BreadcrumbList structured data, and a self-referential canonical.',
    protects:
      'Prevents the region page from ceding "X beaches" to our own sub-guides again — the 05/08/2026 cannibalisation where three of our URLs sat at position 13-15 with zero clicks.',
    failureAction:
      'Fix buildRegionHeadCopy / staticRegionFallback / buildRegionPage in scripts/prerenderBeachPages.mjs, then rebuild. Details in reports/seo/region-pages.json.',
    command: npmBin,
    args: ['run', 'quality:region-pages'],
  },
  {
    id: 'static-shelter-verdict',
    title: 'The static page prints the measured verdict, exactly',
    description:
      'Reads the baked localWindStatus for every beach and every built beach page in all five languages, and asserts the page contains that level\'s exact LOCAL_WIND_SECTION sentence (the same copy the app shows) and NEITHER of the other two levels\' sentences — over-claim and under-claim both. Also checks shelteredFromLocalWind never disagrees with the three-level status it was reduced from. Then reruns itself with the levels rotated and requires mass failures, proving it is not decorative.',
    protects:
      'The 06/08/2026 competitor audit found our nationally measured shelter verdict never reached the static layer Google and first-time visitors read — the page hedged with orientation and deferred to "the app". Now that the verdict IS printed on ~8.000 pages, the new possible lie is the page claiming protected over data that says exposed (or the reverse). Both directions are checked because the 05/08 lesson is that every earlier gate looked only one way.',
    failureAction:
      'Fix the verdict paragraph in buildBeachNarrative (scripts/prerenderBeachPages.mjs) or rerun node scripts/bakeLocalWindShelter.mjs if the baked data is stale, then rebuild. Never edit the gate\'s sentence lists independently: they import utils/localWindContext.mjs, the same single source the app renders.',
    command: process.execPath,
    args: ['scripts/validateStaticShelterVerdict.mjs', '--prove'],
  },
  {
    id: 'beach-meta-descriptions',
    title: 'The Google snippet is truthful and is not the same sentence on 241 pages',
    description:
      'Reads the <meta name="description"> of every built beach page in all five languages and asserts four things: it never claims a shelter level the baked localWindStatus contradicts (checked with loose vocabulary, not just our own generated strings, so hand-written copy is covered too); beaches with a baked verdict actually print it; no single snippet body covers more than 7% of a language\'s pages and the distinct-body count has not regressed; and nothing exceeds 160 characters.',
    protects:
      'Search Console 06/07-02/08/2026: the 2.854 beach pages earned 4.509 impressions and 44 clicks — 1,0% against 16,9% on the home page — with pages at position 3,6 taking zero clicks. Rank did not explain it. Measured on the build, 2.854 Greek pages shared only 926 distinct snippet bodies and the measured verdict never reached the snippet at all. The gate also caught two hand-written overrides telling Google a beach was "υπήνεμη στο μελτέμι" over data that says exposed.',
    failureAction:
      'Fix beachMetaDescription / beachTraitMetaDescription / SEO_META_DESCRIPTION_OVERRIDES in scripts/prerenderBeachPages.mjs, then rebuild. If distinctness regressed, a trait clause has probably stopped being emitted — check beachTraitList against the beach data shape before relaxing the floor.',
    command: process.execPath,
    args: ['scripts/validateBeachMetaDescriptions.mjs'],
  },
  {
    id: 'landing-guide-links',
    title: 'Every guide the landing links actually exists',
    description:
      'Takes the six curated topic×region pairs the national landing links (utils/landingGuideLinks.ts), resolves each one through the same locale-prefix rule the app uses, and asserts the built page is on disk for all five languages — 30 URLs. Also refuses an empty pair list, a repeated topic, a region id missing from the beach index, and a topic key that is not in GUIDE_TOPICS.',
    protects:
      'The landing cannot check these links the way every other surface does: the ≥5-beach predicate gate needs a region\'s beach records loaded and the landing loads none, so the pairs are named by hand. Two ways that rots silently — a data correction drops a topic under the threshold and the page stops being generated, or the slug drifts (getRegionUrlSlug normalises the region ID while the prerender normalises region.name.en, and they already disagree on Pelion: magnesia-mainland-pelion vs the magnesia-pelion on disk). Either one ships a 404 from the page with the site\'s best CTR, 16,9%.',
    failureAction:
      'Either fix the pair in utils/landingGuideLinks.ts (the slug is written out literally on purpose — copy it from the directory name under dist/), or, if a guide genuinely stopped qualifying, swap that pair for another topic and rebuild.',
    command: process.execPath,
    args: ['scripts/validateLandingGuideLinks.mjs'],
  },
  {
    id: 'sitemap-lastmod',
    title: 'The sitemap says which pages actually changed',
    description:
      'Checks that every sitemap <lastmod> comes from the committed content ledger (data/sitemapLastmod.json) rather than from the clock: the ledger is tracked by git, it covers every sitemap URL, no date disagrees with it and none is in the future. Then drives the real fingerprint function (utils/sitemapFingerprint.mjs) against six crafted pages and requires it to IGNORE renamed asset chunks and embedded build timestamps while NOTICING an edited title, meta description or body text.',
    protects:
      'URL Inspection on 16/08/2026 found 4 in 10 of our pages are not in Google\'s index at all — 11/18 English beach pages indexed, 6/15 Italian, most of the rest "Discovered – currently not indexed", meaning Google saw the URL and never fetched it. lastmod is the only crawl-priority signal we have and it was pure noise: 9.536 URLs carried TWO distinct dates, because every page without an explicit date got new Date() on each build and every beach page inherited its region data file\'s timestamp. Two silent ways to undo the fix: the ledger stops being tracked (Netlify builds from a clean checkout, so an untracked ledger is an empty one and every deploy re-stamps all 9.536 pages), or the fingerprint starts covering <script>/<link> tags (Vite renames asset chunks on any code change, marking the whole site modified).',
    failureAction:
      'If the ledger is untracked: git add data/sitemapLastmod.json — never gitignore it. If dates disagree with the ledger, something is writing lastmod outside it in scripts/prerenderBeachPages.mjs. If the fingerprint self-test fails, utils/sitemapFingerprint.mjs has started reading volatile markup — put it back to title/description/canonical/JSON-LD/visible-text only. Verify any change the way it was verified originally: two consecutive clean `npm run build` runs, where the second must report "0 of N pages changed content".',
    command: process.execPath,
    args: ['scripts/validateSitemapLastmod.mjs'],
  },
  {
    id: 'indexed-urls-resolve',
    title: 'Κάθε διεύθυνση που δείχνει το Google ανοίγει',
    description:
      'Παίρνει τις διευθύνσεις που το Search Console κατέγραψε ότι σερβιρίστηκαν πραγματικά σε κόσμο (reports/snapshots/_raw-pages-*.json) και ρωτάει για την καθεμία: υπάρχει αρχείο στο dist, ή την πιάνει κανόνας του dist/_redirects; Διαβάζει τους κανόνες όπως το Netlify — πρώτο ταίριασμα κερδίζει, το υπαρκτό αρχείο υπερισχύει του μη-εξαναγκασμένου κανόνα, το :placeholder πιάνει ένα τμήμα και το /* τα υπόλοιπα — και ακολουθεί τις ανακατευθύνσεις, γιατί ένα 301 προς σελίδα που δεν υπάρχει είναι το ίδιο 404, μία στάση αργότερα. Χωρίς στιγμιότυπο στον δίσκο δεν κρίνει: το λέει καθαρά και περνάει.',
    protects:
      'Στις 21/08/2026 βρέθηκαν 24 διευθύνσεις που κατατάσσονταν στο Google και έβγαζαν σκέτο 404 — 256 εμφανίσεις και 13 κλικ ανά 28 ημέρες στο κενό, χωρίς κανένα σήμα πουθενά. Τρεις αιτίες, καμία ορατή στα υπόλοιπα εργαλεία: η μετονομασία slug έγραφε 301 μόνο για το αγγλικό URL, μόνο ο ένας από τους οκτώ οδηγούς έπαιρνε 301 όταν αποσυρόταν (η πύλη ηλιοβασιλέματος 200-340° κόστισε σε Πάτμο, Λειψούς, Τέλενδο και Λασίθι τη σελίδα τους), και οι παραλίες που σβήνονται από τα δεδομένα δεν αφήνουν πίσω τους κανένα ίχνος. Ο έλεγχος του sitemap δεν τα πιάνει: κοιτάει τι δημοσιεύουμε, όχι τι κρατάει ακόμα το Google.',
    failureAction:
      'Διόρθωσε τη γεννήτρια στο scripts/prerenderBeachPages.mjs — ΠΟΤΕ μη γράψεις κανόνες στο χέρι στο dist/_redirects, το αρχείο ξαναχτίζεται σε κάθε build και η διόρθωση θα εξαφανιστεί σιωπηλά. Οι κανόνες-δίχτυ μπαίνουν ΤΕΛΕΥΤΑΙΟΙ επίτηδες: το Netlify εφαρμόζει το πρώτο ταίριασμα, οπότε κάθε ακριβής 301 πρέπει να προηγείται. Μη βάλεις ΠΟΤΕ θαυμαστικό (!) σε αυτούς τους κανόνες — θα σκίαζαν 9.558 ζωντανές σελίδες.',
    command: process.execPath,
    args: ['scripts/auditIndexedUrlsResolve.mjs'],
  },
];

const printExplanation = () => {
  console.log('Beach Buddy Critical Quality Gate');
  console.log('');
  console.log('Purpose: catch critical beach data, recommendation, wording, typecheck, and build problems before deploy.');
  console.log('Rule: the gate reports problems; it does not invent or auto-correct beach facts.');
  console.log('');
  console.log('Checks:');
  checks.forEach((check, index) => {
    console.log(`${index + 1}. ${check.title}`);
    console.log(`   What it checks: ${check.description}`);
    console.log(`   Why it matters: ${check.protects}`);
    console.log(`   If it fails: ${check.failureAction}`);
  });
  console.log('');
  console.log('Commands:');
  console.log('- npm run quality:explain   Show this explanation only.');
  console.log('- npm run quality:beach-data Run only the beach/photo data validator.');
  console.log('- npm run quality:critical   Run the full gate once.');
  console.log('- npm run quality:auto       Run the full gate, retrying up to 3 times.');
  console.log('');
  console.log('Report: .tmp/critical-quality-report.json');
};

const tail = (value, maxLines = 80) => {
  const lines = String(value || '').split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines).join('\n');
};

const runCheck = check => {
  const startedAt = new Date().toISOString();
  const result = spawnSync(check.command, check.args, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
    shell: process.platform === 'win32' && check.command.endsWith('.cmd'),
    env: check.env ? { ...process.env, ...check.env } : process.env,
  });

  const exitCode = typeof result.status === 'number' ? result.status : 1;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const evaluation = typeof check.evaluate === 'function'
    ? check.evaluate({ stdout, stderr, exitCode })
    : {
        ok: exitCode === 0,
        reason: exitCode === 0 ? 'passed' : `process exited with ${exitCode}`,
      };

  if (result.error) {
    evaluation.ok = false;
    evaluation.reason = result.error.message;
  }

  return {
    id: check.id,
    title: check.title,
    command: [check.command, ...check.args].join(' '),
    ok: evaluation.ok,
    reason: evaluation.reason,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString(),
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  };
};

const runAttempt = attempt => {
  console.log(`\nCritical quality gate attempt ${attempt}/${maxAttempts}`);
  const results = [];

  for (const check of checks) {
    process.stdout.write(`- ${check.title}: ${check.description} ... `);
    const result = runCheck(check);
    results.push(result);
    console.log(result.ok ? 'pass' : 'fail');

    if (!result.ok) {
      console.log(`  ${result.reason}`);
      // WHAT THE CHECK ITSELF SAID — added 13/08/2026.
      //
      // Every check in this suite ends by naming the exact thing that is wrong («gr @320px:
      // «Χωμάτινος» is clipped by 3px»). None of it was ever printed: the runner captures
      // stdout/stderr, files them into .tmp/critical-quality-report.json, and shows only
      // «process exited with 1». That is readable locally, where the report file is on disk —
      // and completely unreadable on CI, where the report is deleted with the runner.
      //
      // The cost: 39 of the 60 runs before this date were red, on the same check, and no one
      // could tell from GitHub what the check had found. A gate whose failure cannot be read
      // is not a gate — it is a red light people learn to walk past, which is the exact
      // failure mode the workflow file warns about at the top.
      const said = tail(result.stderrTail || result.stdoutTail || '', 40);
      if (said) {
        console.log('  What it said:');
        for (const line of said.split('\n')) console.log(`    ${line}`);
      }
      console.log(`  Next step: ${check.failureAction}`);
    }
  }

  return {
    attempt,
    ok: results.every(result => result.ok),
    results,
  };
};

const main = () => {
  if (args.has('--explain')) {
    printExplanation();
    return;
  }

  printExplanation();

  const attempts = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runAttempt(attempt);
    attempts.push(result);

    if (result.ok) {
      break;
    }

    if (attempt < maxAttempts) {
      console.log('Quality gate still failing; rerunning bounded retry.');
    }
  }

  const finalAttempt = attempts[attempts.length - 1];
  const report = {
    ok: finalAttempt.ok,
    maxAttempts,
    attempts,
    generatedAt: new Date().toISOString(),
  };

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`\nQuality report: ${path.relative(rootDir, reportPath).replaceAll(path.sep, '/')}`);
  if (finalAttempt.ok) {
    console.log('Critical quality gate passed.');
    return;
  }

  console.log('Critical quality gate failed.');
  process.exitCode = 1;
};

main();
