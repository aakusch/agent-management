---
id: summarize
name: Ship summary
description: Turn run artifacts into a concise handoff or pull request description.
kind: agent
icon: file-check
color: cyan
version: 1.0.0
tags: output, documentation
inputs: patch, findings, test_report
outputs: summary
---

Create a concise final handoff for **{{project.name}}**.

Include what changed, why, verification performed, and any remaining risks. Prefer concrete evidence over process narration. Format the result so it can be pasted into a pull request description.
