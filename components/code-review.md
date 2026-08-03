---
id: code-review
name: Code review
description: Review the implementation for correctness, safety, and maintainability.
kind: judge
icon: scan
color: blue
version: 1.0.0
tags: review, quality
inputs: patch, project_context
outputs: verdict, findings
---

Review the current patch against the task and the conventions in `{{project.instructions}}`.

Prioritize findings that can cause incorrect behavior, regressions, security issues, data loss, or broken tests. Include file and line references. Do not block on style preferences already enforced by tooling.

Return:

1. `verdict`: `pass` or `revise`
2. `findings`: ordered by severity
3. `summary`: one concise paragraph
