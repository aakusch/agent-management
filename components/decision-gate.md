---
id: decision-gate
name: Quality gate
description: Route execution based on structured verdicts from upstream reviewers.
kind: router
icon: split
color: coral
version: 1.0.0
tags: logic, routing
inputs: verdicts
outputs: route
---

Read every upstream verdict.

- Route to `ship` only when all required verdicts are `pass`.
- Route to `revise` when any required verdict is `revise`.
- Route to `blocked` when a required verdict is missing or malformed.

Return only the selected route and a one-sentence reason.
