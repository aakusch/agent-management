---
id: build-runner
name: Run build
description: Produce the project or affected-package build and record actionable failures.
kind: tool
icon: terminal
color: amber
version: 1.0.0
tags: build, compile, verification
inputs: affected_packages, command_map
outputs: verdict, build_report
---

Run the repository-native build for the affected scope. Preserve generated outputs according to project rules and do not publish artifacts. Return command, working directory, exit code, duration, and the smallest actionable failure excerpt.
