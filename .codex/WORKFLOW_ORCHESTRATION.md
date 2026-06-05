# Beach Buddy Workflow Orchestration

Use this before choosing project agents or starting any non-trivial Beach Buddy task.

This file adapts the workflow notes from the user's reference image for this repo. The goal is not more ceremony. The goal is fewer repeated mistakes, cleaner context, and more reliable delivery.

Before non-trivial CalmBeach / Beach Buddy work, read:
- `docs/BEACH_BUDDY_AGENT_CONTEXT.md`
- `docs/AGENT_SOURCE_MAP.md`
- `docs/WIND_PROFILE_GUIDELINES.md`
- `docs/VALIDATION_PLAYBOOK.md`

Use these as shared source of truth for product goals, agent responsibilities, source lookup rules, windProfile rules, confidence handling, and validation requirements. `docs/AGENT_SOURCE_MAP.md` is mandatory for agent responsibilities and information sources. For scoring, windProfile, weather, recommendations, or local beach behavior, `docs/WIND_PROFILE_GUIDELINES.md` and `docs/VALIDATION_PLAYBOOK.md` are mandatory.

For all non-trivial work, correct beach prediction and recommendation comes first. Do not add complexity unless it improves recommendation accuracy, trust, or clarity. Unknown is better than false certainty. Do not create false calm/protected/safe/ideal claims.

## 1. Plan-First Default

Use a lightweight plan for any non-trivial task.

A task is non-trivial when it has any of these:
- 3 or more implementation steps
- architecture, scoring, data model, API, map, privacy, deployment, or analytics impact
- broad UI behavior changes
- unclear user intent
- risk of changing recommendation trust

For tiny fixes, do the work directly after a short note. Do not over-plan obvious copy, label, or one-line UI fixes.

If the task starts going sideways, stop, restate what changed, and re-plan before editing further.

## 2. Agent Strategy

Use agents only when they materially improve the result and when the current Codex runtime permits agent calls.

Good reasons to use agents:
- independent research or review can run in parallel
- the task spans distinct specialties, such as UX plus scoring plus geospatial data
- a risky change needs a second-pass QA or architecture review
- the work can be split into non-overlapping files or responsibilities

Bad reasons to use agents:
- tiny copy/data fixes
- tasks where local code inspection is faster
- vague delegation without a clear output
- duplicate analysis that will slow the critical path

When using agents:
- give each agent one focused task
- define the exact files or responsibility area
- ask for concrete output, risks, and changed files
- keep the main thread moving on non-overlapping work
- integrate and verify their output before presenting it as done

## 3. Self-Improvement Loop

Treat user corrections as durable product knowledge when they reveal a repeatable pattern.

After a correction:
- identify the pattern, not just the individual fix
- update the relevant workflow or product rule if it will prevent the same mistake
- keep the lesson short and actionable
- avoid recording one-off preferences that do not generalize

Current durable lessons:
- Do not describe difficult beach access as "4x4 only" in user-facing copy. Prefer "Difficult road" / "Dusvatos dromos" style wording unless verified as strictly impossible for normal vehicles.
- Avoid repeating the same beach cards in multiple home-screen sections. The user should not scroll past duplicate recommendations.
- Warning chips must not contradict the main condition summary. Only show wave warnings when the beach has real wave risk after protection/exposure is considered, and use specific wording such as "Some waves" or "High waves" instead of vague "Wave today" copy.
- When sea condition scores depend on exposure/protection as well as wave height, compact cards must show that context so equal wave heights do not look inconsistent across beaches.
- Top recommendations must prioritize wind-protected beaches. Do not rank partially protected or exposed beaches above protected options when protected options exist in the selected area.
- The default beach list should show wind-protected beaches, not all beaches. Only default to all beaches when the weather is good/light wind and every beach in the selected area is protected for the current wind direction.
- When severe weather or rough sea makes every beach unsuitable, show an explicit no-swimming message instead of a generic empty beach list.
- Protected beach badges should use the full Greek label "Προστατευμένη" and must not truncate the word on mobile cards.
- Top picks should be time-aware when hourly data exists: show until when the current pick remains strong, and prefer active/upcoming beach windows over expired ones.
- Do not show raw suitability percentages such as "71%" in the top pick hero; use human-readable reasons and timing instead.
- Map beach detail panels must reserve space for the close button; badges and labels should truncate before overlapping the X control.
- Maps should show wind direction visually with a compact compass/flow arrow when wind data exists, without blocking markers, popups, or map controls.
- The daily top recommendation must be stable for the same island and weather. Do not let user distance, stored preferences, or local client state change the "best beach today"; those can affect explore/filtering instead.
- When weather suitability is close, top recommendations should prefer mainstream, easy, practical beaches using existing signals such as popularity, rating, access, family fit, and facilities. Do not let this override clearly better wind/sea safety.
- Do not mechanically transliterate Latin/Greeklish beach names into Greek display text. Use verified Greek names where available; otherwise keep the Latin source name until it is verified. Always normalize final sigma in Greek beach names.
- Hero/background photos must be specific to each selectable island or area whenever a license-safe source exists. Do not reuse one regional photo across distinct islands unless the fallback is clearly documented.
- Beach cards should prefer one verified photo per beach. Island-level fallback photos are only temporary coverage and should not be treated as each beach's own photo.
- Greek generated beach copy must use inflected area/island phrases, not raw nominative labels. Prefer explicit forms like "της Μήλου", "στη Μήλο", "των Χανίων", "στο Ρέθυμνο" in label metadata.

- Map wind-exposure colors should follow the explicit Beaufort legend: 0-2 Bft all blue; 3-4 Bft protected blue and exposed/partial yellow; 5-6 Bft protected yellow and exposed/partial orange; 7-10 Bft all red. Keep the legend visible and do not imply that blue means guaranteed safety.
- Map color explanations should only describe colors visible for the current forecast. Do not show red/orange legend rows on a 3-4 Bft map where users only see blue/yellow markers.
- Map color explanations should show the marker colors as colored dots next to meaning labels such as protected/exposed. Avoid writing visible color words like blue/yellow/orange/red in the compact legend.
- Map color explanations should be shown directly without a heading such as "Color guide" / "Επεξήγηση Χρωμάτων" when displayed below the map.
- Map markers should respect active search, filters, and filter-like sort modes. When users filter the beach list, hide non-matching markers instead of leaving irrelevant colored points on the map.
- At 0-3 Bft, never force a single "top beach today" recommendation. Show a light-wind/calm-all-around message and let users choose by preference, access, and vibe. From 4 Bft upward, wind can drive top recommendations.
- Calm/light-wind messages should be short and direct. At 0-2 Bft, treat the day as broadly suitable and keep the title/count aligned, e.g. "2 μποφόρ σήμερα. Όλες οι παραλίες είναι κατάλληλες!" with an all-beaches count.
- Detail-page planner warnings must not contradict the home summary. At 0-2 Bft with normal swimming temperatures, do not show "conditions are not ideal" unless there is a real critical warning such as storm, rain, winter unsafe conditions, or missing forecast data.
- Home top picks and detail pages must use the same forecast source. If a top pick is selected with beach-specific forecast data, pass that same beach-specific day/hourly forecast into the detail page and planner so the app never recommends a beach while the detail page says conditions are not ideal.
- Detail-page crowd labels must not look like weather-condition labels. Use explicit wording such as "Μέτρια κίνηση" and avoid amber warning styling for normal medium crowd levels.
- Do not defer the core beach list or the map behind artificial loading gates. Lightweight optimizations are fine, but the first beach-decision UI should appear as soon as beach data is available, even while weather details continue loading.
- Do not label a beach as "quiet" when it has a beach bar. In filters and generated copy, beach bar overrides quiet-style wording because the combination feels contradictory to users.
- Do not show difficult-access beaches as ideal/top recommendations when any practical-access beach is recommendable. Hard access is only a fallback when no practical option passes the wind/sea checks.

## 4. Verification Before Done

Never mark work complete without evidence.

Choose verification based on the change:
- TypeScript or React changes: run `npm run lint`
- production-impacting changes: run `npm run build`
- data changes: validate counts, affected labels, or JSON parsing
- UI changes: inspect the relevant screen or explain why visual verification was not run
- bug fixes: reproduce or describe the before/after behavior

Before final response, ask:
- Did I change only what was necessary?
- Did I preserve the core promise: choose the right beach in under 10 seconds?
- Would a staff engineer accept the scope and verification?
- Are remaining risks clear?

## 5. Balanced Elegance

Prefer the simplest robust solution.

For non-trivial changes, pause before editing and ask:
- Is there a cleaner place to make this change?
- Can this be solved by data flow instead of duplication?
- Am I preserving existing patterns?
- Is this readable and debuggable?

Do not over-engineer obvious fixes. Do not create abstractions until they remove real complexity.

## 6. Autonomous Bug Fixing

When the user reports a bug, own the investigation.

Default behavior:
- inspect code and logs first
- find the root cause
- fix the smallest responsible surface
- run relevant verification
- explain the behavior change plainly

Do not ask the user to debug for you unless the missing information cannot be discovered locally.

## 7. Task Management

For larger tasks, maintain a visible checklist in the conversation or a task file if the user asks for persistent tracking.

Checklist rules:
- write checkable items
- mark progress as work completes
- summarize changes at meaningful milestones
- document verification and residual risks at the end

Do not create persistent task files for small changes unless explicitly useful.

## 8. Core Principles

- Simplicity first: smallest change that solves the real problem.
- No lazy fixes: find root causes, avoid temporary patches.
- Minimal impact: touch only necessary files.
- MVP first: do not expand the product unless it improves beach choice.
- Trust first: recommendation wording must be accurate, humble, and tourist-friendly.
- Mobile first: reduce repeated scrolling and duplicated information.
