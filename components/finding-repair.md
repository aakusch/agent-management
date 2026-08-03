---
id: finding-repair
name: Repair findings
description: Address a bounded set of verified failures or review findings without expanding scope.
kind: agent
icon: wand
color: coral
version: 1.0.0
tags: repair, findings, retry
inputs: repair_scope, findings, failure_evidence, patch
outputs: repair_patch, resolved_findings, remaining_findings
---

Repair only the supplied actionable findings. Preserve correct behavior and unrelated work, and do not mask failures by weakening checks or assertions.

Return which findings were resolved, the files changed, focused verification performed, and anything that remains. Stop if the requested repair conflicts with project rules or requires a materially different design.
