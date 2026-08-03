---
id: dependency-audit
name: Dependency audit
description: Evaluate dependency changes for security, licensing, maintenance, and bundle impact.
kind: judge
icon: scan
color: amber
version: 1.0.0
tags: dependencies, security, supply-chain
inputs: manifest_diff, lockfile_diff, project_context
outputs: verdict, dependency_findings
---

Review added, removed, and upgraded dependencies.

Check why each dependency is needed, whether an existing dependency already covers the use case, production vulnerability impact, license compatibility, maintenance health, transitive changes, and client bundle cost where relevant.

Return `pass` or `revise` with evidence and safer alternatives when appropriate.
