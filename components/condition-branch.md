---
id: condition-branch
name: Condition branch
description: Route true or false by evaluating a typed expression against upstream outputs.
kind: router
icon: split
color: violet
version: 1.0.0
tags: logic, condition, boolean, branch
inputs: values, expression
outputs: route, evaluation
---

Deterministically evaluate the configured expression against declared upstream values. Return `true` or `false` plus the resolved operands. Missing or invalid operands must route to `error`; never ask an agent to guess a boolean result.
