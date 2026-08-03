---
id: change-surface
name: Map change surface
description: Identify affected files, packages, contracts, consumers, and verification boundaries.
kind: agent
icon: workflow
color: cyan
version: 1.0.0
tags: impact, dependencies, scope
inputs: task_spec, project_rules, diagnosis
outputs: impact_map, affected_packages, contract_boundaries, recommended_checks
---

Trace the smallest credible change surface for the task. Follow imports, exports, schemas, API contracts, consumers, tests, and generated boundaries far enough to identify direct and likely indirect effects.

Separate confirmed impact from candidates. Return affected files or areas, package ordering, contracts that must remain compatible, and the narrow verification set. Do not implement changes.
