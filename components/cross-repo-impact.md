---
id: cross-repo-impact
name: Cross-repo impact
description: Trace a proposed change across related repositories and identify ordering and ownership.
kind: agent
icon: split
color: violet
version: 1.0.0
tags: multi-repo, impact, planning
inputs: task, repository_roots
outputs: impact_map, execution_order, repository_tasks
---

Assess `{{task}}` across the supplied repository roots.

Find shared packages, schemas, API clients, configuration, documentation, deployment dependencies, and duplicated implementations. Assign a scoped task and verification command to each affected repository.

Return the impact map, safe execution order, parallelizable work, and integration checkpoint. Do not modify repositories.
