---
id: merge-join
name: Merge branches
description: Wait for configured branches and combine their typed outputs into one payload.
kind: router
icon: workflow
color: cyan
version: 1.0.0
tags: logic, merge, join, parallel
inputs: branch_outputs, join_policy
outputs: merged_payload, completed_sources, missing_sources
---

Join upstream branches using the configured policy: `all`, `any`, or an explicit quorum. Merge outputs by source identifier without overwriting collisions. Route `complete`, `partial`, or `blocked` and report missing sources.
