---
id: all-pass-gate
name: All pass gate
description: Continue only when every required upstream verdict passes.
kind: router
icon: shield
color: mint
version: 1.0.0
tags: logic, all, pass, gate, boolean
inputs: verdicts, required_sources
outputs: route, failed_sources
---

Wait for every required source. Route `pass` only when all verdicts are `pass`. Route `fail` with the failing source identifiers when any verdict fails. Route `incomplete` when a required verdict is absent or unavailable.
