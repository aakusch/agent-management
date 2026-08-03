---
id: package-impact-analysis
name: Trace package impact
description: Resolve affected workspace packages, dependency direction, and the correct validation order.
kind: agent
icon: workflow
color: cyan
version: 1.0.0
tags: monorepo, packages, dependencies
inputs: task_spec, project_rules, patch
outputs: package_impact, execution_order, affected_package_checks
---

Inspect workspace configuration, package manifests, exports, imports, and build orchestration. Identify directly changed packages, downstream consumers, shared contracts, and the smallest correct command filters.

Return a dependency-aware execution order and distinguish required integration checks from optional broad checks. Do not modify files.
