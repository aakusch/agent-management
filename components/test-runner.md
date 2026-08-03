---
id: test-runner
name: Test runner
description: Run the project checks and normalize their results for downstream gates.
kind: tool
icon: terminal
color: amber
version: 1.0.0
tags: test, tool
inputs: patch, project_context
outputs: verdict, test_report
---

Run the following commands in order and stop on the first failure:

{{commands.test}}

Return the command, exit code, duration, and the smallest useful error excerpt. Never modify application code while acting as the test runner.
