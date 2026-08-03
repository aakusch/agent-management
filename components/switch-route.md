---
id: switch-route
name: Switch route
description: Select the first matching named case and otherwise follow the default branch.
kind: router
icon: split
color: violet
version: 1.0.0
tags: logic, switch, cases, decision-tree
inputs: value, cases
outputs: route, matched_case
---

Evaluate configured cases in declared priority order using deterministic equality or comparison operators. Select the first match. If none match, select `default`; if no default exists, route `unmatched` and pause rather than choosing arbitrarily.
