---
id: typecheck-runner
name: Run typecheck
description: Execute repository-native static type verification for the affected scope.
kind: tool
icon: terminal
color: amber
version: 1.0.0
tags: typecheck, static, verification
inputs: affected_packages, command_map
outputs: verdict, typecheck_report
---

Run the configured typecheck for the affected scope, preferring an existing targeted workspace command when available. Return command, working directory, exit code, duration, and concise diagnostics. If the project has no typecheck capability, return `unavailable` with evidence rather than passing.
