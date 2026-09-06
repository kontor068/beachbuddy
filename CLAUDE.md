# CalmBeach

Free B2C platform that tells tourists which Greek beach to go to today, based on live wind
and wave conditions and each beach's orientation. **2.850 beaches across 110 regions**, five
languages (EN / EL nationally; DE / FR / IT for 17 tourist regions). React + Vite +
TypeScript, pre-rendered to ~9.500 static pages, hosted on Netlify with DNS on Cloudflare.
No database and no server — twelve small Netlify functions.

## How to work on this project

**Use the `calmbeach-team` skill for anything substantive.** It holds 16 specialists —
product, UX, community, frontend, data, weather, algorithm, devops+backend, QA, security,
SEO, content, growth, monetization, legal, cost & quotas — and it knows the project's
history, decisions and open risks. Questions, plans, reviews, "what next", "is this a good
idea", or reporting that something shipped all belong to it. Answering them as a generic
assistant loses everything the team has learned.

**`docs/team/` is the project's memory.** `00-STATUS-BOARD.md` first — it says where we are.
Then the numbered role docs, then `99-decision-log.md` for what's already been decided and
why. Read before advising; a recommendation that contradicts a logged decision without
noticing is worse than no recommendation.

**`docs/team/` is gitignored on purpose — this repository is public.** The docs hold
commercial positioning, legal history and a map of our own weak points, so they stay on disk
like `docs/competitor-strategy.md` and `reports/snapshots/`. Two consequences: never suggest
committing them **to this repo**, and never restate their commercial, legal or security
contents inside a tracked file (code comments, README, `.claude/`). They travel between
machines through a separate **private** repo cloned inside `docs/team/` — see
[Working from more than one machine](docs/DEV-ENVIRONMENT.md#working-from-more-than-one-machine).
If that clone is missing the folder is simply empty, and the session is working without memory.

**Keep the docs current.** When a fact is established, a decision taken, or a risk changes,
update the relevant doc in the same session. Nobody will go back and do it later.

**Verify before claiming.** The code is the authority on how things work; the docs describe
how things were last time someone wrote about them. Grep before asserting that something is
missing, broken or fixed — including when the user says he just changed it. **Every ✅ in
`docs/team/` carries the file it was seen in**; a claim with no file path is 🟡, not ✅. That
rule exists because the first version of those docs was written without reading the code and
got six headline findings wrong.

## Language

Miltos works in Greek and wants plain explanations, not jargon. Answer in Greek unless he
writes in English.
