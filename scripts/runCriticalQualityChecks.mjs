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
    id: 'swell-origin-copy',
    title: 'The card says where the sea came from',
    description: 'Drives the beach page\'s live sentence in all five languages over a measured light-wind/running-sea reading and checks it names the direction the swell arrived from — then checks it stays completely silent on ordinary short-period chop, on a swell too small to matter, on a swell that is only part of the sea, and when no direction is known. Also checks the origin phrase itself is a whole per-language string («από τα βόρεια», «de l\'est») and that the beach page still hands the swell channel over.',
    protects: 'Prevents a correct page reading like a broken one. Reported from Ταυρωνίτης (Χανιά) 02/08/2026: 2 Bft on the compass over a 1,6 m sea, with no explanation anywhere on the page — measured the same hour, the local wind was making 0,16 m of its own and 1,26 m at 5,7 s was arriving from the north. The existing swell section could not help: it only opens above 7 s, a bar an ordinary Aegean swell never clears. The silence rules matter as much as the sentence — inventing a cause for ordinary wind chop would be worse than the silence it replaced. It also holds the Greek phrase away from the masculine wind adjective, which had already shipped as «από τα Βόρειος» in the swell section.',
    failureAction: 'Restore the wiring or the clause the gate names. Never widen a threshold to make a case speak — the sentence is only allowed where the marine reading carries it, and it must never change a score, a colour or a verdict.',
    command: process.execPath,
    args: ['scripts/validateSwellOriginCopy.mjs'],
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
    description: 'Compares the wave thresholds and the swell-equivalent formula between utils/waveCharacter.ts and the Python that builds data/waveClimatology.generated.json, proves the three honesty rules of utils/seaSeasonProfile.mjs by driving them backwards, and reads the prerender call site to confirm it passes beach IDS and the loaded climatology.',
    protects: 'Prevents the intent guides from saying "usually calm" about a beach whose own page paints it orange. The number in the guide comes from a separate Python program that copies the app thresholds, so one edit to SEA_STATE_AMBER_M would desync hundreds of articles with nothing throwing. It also blocks a monthly AVERAGE from being phrased as a percentage of days — an invented figure in convincing clothing — and stops the Ionian guides claiming a Meltemi that does not blow there.',
    failureAction: 'Realign the constants in scripts/buildWaveClimatology.py with utils/waveCharacter.ts, or fix the prerender call site. Never widen a range in the gate to make the generated file pass — regenerate the file instead.',
    command: process.execPath,
    args: ['scripts/validateWaveClimatology.mjs'],
  },
  {
    id: 'water-climatology',
    title: 'Guide water temperature vs the beach page',
    description: 'Checks the cold/mild/ideal thresholds AND their open ends agree across three copies — pages/BeachDetailPage.tsx, the Python that builds the data, and utils/waterSeasonProfile.mjs — that the guide uses the same five-language words the beach page prints, and that the prerender passes beach IDs and the WATER file rather than the wave one.',
    protects: 'Prevents a guide saying the sea is "ideal" in a month whose own beach page calls it "mild". The page treats 24.0 C as mild and only above 24 as ideal; the first Python copy used >= and misclassified 164 months with nothing throwing. It also blocks the wave/water file mix-up, which differs by one letter and would make the paragraph vanish silently, and stops a monthly average being dressed up as something measured at the shoreline.',
    failureAction: 'Realign the thresholds in scripts/buildWaterClimatology.py and utils/waterSeasonProfile.mjs with pages/BeachDetailPage.tsx, or fix the prerender call site. Regenerate the data file rather than widening a range in the gate.',
    command: process.execPath,
    args: ['scripts/validateWaterClimatology.mjs'],
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
