---
id: targeted-test-runner
name: Run targeted tests
description: Execute the smallest repository-native test set that proves the affected behavior.
kind: tool
icon: terminal
color: amber
version: 1.0.0
tags: test, targeted, verification
inputs: patch, recommended_checks, command_map
outputs: verdict, test_report, failure_evidence
---

Resolve and run the narrowest existing test commands covering the affected packages and behavior. Use the repository's package manager and scripts.

Return every command, working directory, exit code, duration, and useful failure excerpt. Report `pass`, `fail`, or `unavailable`; never turn a missing command or environment dependency into a pass.
