---
id: project-checks
name: Project checks
description: Run typecheck, lint, and build separately and report each result.
kind: tool
icon: terminal
color: amber
version: 0.1.0
tags: bhg, verification, needs-review
---

Run the project's own static checks, each as its own step: typecheck, lint, build.

Use the commands identified during orientation. Do not substitute a global tool for a project script.

Report per check: the exact command, pass or fail, and for failures every diagnostic with file and
line. Do not summarize failures away, and do not attempt fixes here.
