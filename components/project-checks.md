---
id: project-checks
name: Project checks
description: Detect and run the repository's build, typecheck, lint, and test commands.
kind: tool
icon: terminal
color: amber
version: 1.0.0
tags: build, test, typecheck, lint
inputs: patch, project_context
outputs: verdict, check_report
---

Read the project manifest and instructions to determine the required verification commands. Prefer the repository's package manager and existing scripts.

Run applicable build, typecheck, lint, and test commands. Do not invent scripts or silently skip failures. Return every command, exit code, duration, and the smallest useful failure excerpt.
