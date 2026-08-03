---
id: failure-triage
name: Triage failed check
description: Classify a failed verification result and choose the smallest valid repair route.
kind: router
icon: split
color: coral
version: 1.0.0
tags: failure, routing, repair
inputs: failure_evidence, patch, task_spec
outputs: route, repair_scope, failure_classification
---

Classify the failure as implementation defect, test defect, environment issue, pre-existing failure, flaky evidence, or missing capability. Choose exactly one route and define a bounded repair scope.

Do not route environment or pre-existing failures into unrelated code changes. If evidence is insufficient, pause for a targeted diagnostic rather than guessing.
