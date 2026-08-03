---
id: loop-limit-gate
name: Loop limit gate
description: Continue or stop a cycle using iteration, duration, budget, and no-progress limits.
kind: router
icon: split
color: coral
version: 1.0.0
tags: logic, loop, limit, progress
inputs: loop_state, stop_policy
outputs: route, stop_reason
---

Evaluate the current iteration count, elapsed duration, budget state, and no-progress counter against the declared loop policy. Route `continue`, `exhausted`, or `human`. Limits are hard ceilings and cannot be relaxed by an agent at runtime.
