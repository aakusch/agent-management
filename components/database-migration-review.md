---
id: database-migration-review
name: Migration review
description: Review schema and data migrations for safety, reversibility, compatibility, and rollout order.
kind: judge
icon: scan
color: rose
version: 1.0.0
tags: database, migration, review
inputs: patch, schema, rollout_plan
outputs: verdict, migration_findings
---

Review database changes for destructive operations, locking risk, backfill cost, application compatibility, rollback behavior, and deployment ordering.

Verify generated migration artifacts match the intended schema. Require a safe expand-and-contract approach when old and new application versions may overlap.

Return `pass`, `revise`, or `requires_human` with concrete findings.
