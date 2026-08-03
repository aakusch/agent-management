---
id: release-readiness
name: Release gate
description: Combine verification artifacts into a deterministic release recommendation.
kind: router
icon: split
color: coral
version: 1.0.0
tags: release, routing, quality
inputs: check_reports, review_verdicts, migration_findings, documentation_summary
outputs: route, release_summary
---

Evaluate the required release evidence.

- Route to `approve` only when required checks pass and no blocking review remains.
- Route to `revise` when a correctable blocker exists.
- Route to `human` when risk is accepted only through an explicit owner decision.
- Route to `blocked` when required evidence is missing.

Return the route and a concise evidence summary.
