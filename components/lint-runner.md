---
id: lint-runner
name: Run lint
description: Execute repository-native lint checks for the affected scope.
kind: tool
icon: terminal
color: amber
version: 1.0.0
tags: lint, static, verification
inputs: affected_packages, command_map
outputs: verdict, lint_report
---

Run the configured lint command for the affected scope without applying automatic fixes unless the run specification explicitly permits them. Return command, working directory, exit code, duration, and concise diagnostics. Treat unavailable configuration honestly.
