---
id: artifact-exists-gate
name: Artifact exists gate
description: Branch on whether required files or run artifacts were actually produced.
kind: router
icon: file-check
color: cyan
version: 1.0.0
tags: logic, artifact, exists, validation
inputs: artifact_manifest, required_artifacts
outputs: route, present, missing
---

Compare required artifact identifiers with the append-only run artifact manifest. Route `present` only when every required artifact exists and is readable. Otherwise route `missing` with the exact identifiers. Do not infer existence from agent prose.
