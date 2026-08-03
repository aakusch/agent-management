---
id: root-cause-analysis
name: Diagnose root cause
description: Explain the causal failure chain from evidence gathered during reproduction.
kind: agent
icon: bug
color: rose
version: 1.0.0
tags: diagnosis, debugging, evidence
inputs: reproduction, project_rules
outputs: diagnosis, evidence, rejected_hypotheses, fix_boundary
---

Use the established reproduction to trace the failure to its causal boundary. Inspect runtime state, control flow, data shape, and recent relevant history as needed.

Return the supported root cause, evidence, rejected alternatives, and the smallest safe fix boundary. If the evidence does not isolate one cause, rank hypotheses and specify the next discriminating check. Do not implement the fix.
