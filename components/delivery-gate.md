---
id: delivery-gate
name: Delivery gate
description: Combine checks, tests, and the verdict into one route.
kind: router
icon: split
color: cyan
version: 0.1.0
tags: bhg, gate, needs-review
outcomes: ship, revise, escalate
---

Combine the upstream results into a single route. No model judgment beyond these rules.

- ship: static checks pass, tests pass, and the request verdict is pass.
- revise: any check or test fails, or the verdict is revise, and the loop budget is not exhausted.
- escalate: the verdict is escalate, the loop budget is exhausted, or a failure was diagnosed as
  pre-existing or environmental.

Return the route and the one-line reason, citing which input decided it.
