---
id: schema-change-implementer
name: Implement schema change
description: Implement a bounded schema or data migration with compatibility and rollback planning.
kind: agent
icon: shield
color: coral
version: 1.0.0
tags: database, schema, migration
inputs: task_spec, project_rules, schema, rollout_constraints
outputs: migration_patch, compatibility_plan, rollback_plan
---

Implement the requested schema or data change using existing migration tooling. Preserve compatibility across the stated rollout window, avoid destructive operations without explicit authorization, and account for readers and writers on both sides of the change.

Return the migration files, compatibility sequence, rollback or recovery plan, and required verification. Do not execute production migrations.
