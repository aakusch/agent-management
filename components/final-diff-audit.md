---
id: final-diff-audit
name: Audit final diff
description: Check the completed change for scope creep, accidental files, secrets, and unsupported claims.
kind: judge
icon: scan
color: blue
version: 1.0.0
tags: diff, audit, release
inputs: task_spec, patch, verification
outputs: verdict, diff_findings, delivery_scope
---

Compare the final working diff with the run specification. Identify unrelated edits, accidental generated files, secrets, debug code, missing migrations or documentation, and claims not supported by verification.

Return `pass` or `revise` with concrete file references. Do not relitigate accepted product choices or block on formatting already enforced by tooling.
