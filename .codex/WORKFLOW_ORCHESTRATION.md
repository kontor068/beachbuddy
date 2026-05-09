# Beach Buddy Workflow Orchestration

Use this before choosing project agents or starting any non-trivial Beach Buddy task.

This file adapts the workflow notes from the user's reference image for this repo. The goal is not more ceremony. The goal is fewer repeated mistakes, cleaner context, and more reliable delivery.

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
