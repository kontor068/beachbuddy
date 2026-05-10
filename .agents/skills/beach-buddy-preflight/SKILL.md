---
name: beach-buddy-preflight
description: Use this before any Beach Buddy development task. It improves the user's request, chooses the right agents, defines boundaries, identifies risks, and creates an MVP-first plan before coding.
---

# Beach Buddy Preflight Skill

Use this skill before starting any Beach Buddy development task.

Beach Buddy is a mobile travel app for Greece that helps tourists answer:

“Which beach should I go to today?”

The product must remain:
- simple
- fast
- mobile-first
- MVP-focused
- trustworthy
- useful for tourists in under 10 seconds

## Available Beach Buddy agents

Use only the relevant agents from this list:

- product_lead
- cto_architect
- ux_director
- mobile_engineer
- beach_scoring_scientist
- weather_marine_expert
- geospatial_engineer
- beach_content_director
- growth_strategist
- qa_lead
- data_quality_trust
- security_privacy_gdpr
- devops_release_engineer
- analytics_insights
- api_integration_specialist
- revenue_pricing_strategist

## What to do before coding

Before choosing or calling agents, apply the workflow overlay in:

- `.codex/WORKFLOW_ORCHESTRATION.md`

Use it to decide whether the task is tiny, non-trivial, or complex; whether agents are actually useful; and what verification is required before done.

Before implementing anything:

1. Understand the user's request.
2. Rewrite it into a clearer, safer development task.
3. Choose the relevant agents.
4. Explain why those agents are needed.
5. Define what should NOT be changed.
6. Identify risks, unclear points, and bad assumptions.
7. Create a small MVP-first plan.
8. Decide whether to wait for approval or proceed.

## Coding rules

Do not code immediately unless the task is tiny and low-risk.

Always plan first when the task affects:
- architecture
- data models
- scoring
- APIs
- privacy
- maps
- deployment
- analytics
- recommendation logic

Never:
- rewrite unrelated files
- add dependencies without justification
- change architecture without need
- remove existing functionality without being asked
- expand the product beyond MVP scope

Always protect the core promise:

“Help tourists choose the best beach today in under 10 seconds.”

## Required output format

Before implementation, output exactly this structure:

## Improved task
Rewrite the user's request clearly.

## Agents to use
List only the relevant agents.

## Why these agents
Explain briefly why each agent is needed.

## What not to change
Define clear boundaries.

## Risks / assumptions
List risks, unclear points, and possible bad assumptions.

## MVP-first plan
Give small, practical steps.

## Implementation decision
Choose one:
- Waiting for approval before coding
- Proceeding because this is a small low-risk task
