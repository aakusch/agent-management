---
id: repo-orientation
name: Repository orientation
description: Learn the conventions and name the surface the change touches.
kind: agent
icon: scan
color: blue
version: 0.1.0
tags: bhg, grounding
---

Orient in the repository before writing anything.

Read its instruction files (CLAUDE.md, AGENTS.md, README, contributing notes) and the recent history
touching the relevant area. Then produce a change plan bounded to the request:

- The files and modules you will touch, and why each one.
- The conventions you must follow here (naming, structure, error handling, test placement).
- The project's own commands for typecheck, lint, test, and build, taken from its config — not guessed.
- What you will deliberately not touch.

If the request cannot be satisfied without changing something outside that surface, say so now.
