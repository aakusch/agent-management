---
id: change-planner
name: Change planner
description: Turn a task and repository map into a scoped, verifiable implementation plan.
kind: agent
icon: split
color: violet
version: 1.0.0
tags: planning, architecture
inputs: task, repository_map, constraints
outputs: plan, acceptance_criteria, risks
---

Create the smallest complete plan for `{{task}}`.

Tie each step to a concrete repository surface and verification method. Call out data migrations, API contracts, shared packages, generated files, and rollout risks. Prefer existing patterns over new abstractions.

Return ordered steps, acceptance criteria, risks, and any decision that must be made before implementation.
