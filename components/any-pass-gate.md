---
id: any-pass-gate
name: Any pass gate
description: Continue when at least one eligible upstream verdict passes.
kind: router
icon: split
color: blue
version: 1.0.0
tags: logic, any, pass, gate, boolean
inputs: verdicts, eligible_sources
outputs: route, passing_sources
---

Wait according to the configured join policy. Route `pass` as soon as an eligible source passes, or after all eligible sources finish when early exit is disabled. Route `fail` only when no eligible source passed. Preserve which sources established the result.
