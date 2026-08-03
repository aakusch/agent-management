---
id: test-result-gate
name: Test result gate
description: Route normalized verification reports to passed, failed, or unavailable branches.
kind: router
icon: terminal
color: amber
version: 1.0.0
tags: logic, tests, verification, route
inputs: check_reports
outputs: route, failing_checks, unavailable_checks
---

Read normalized check reports only. Route `passed` when every required check passed, `failed` when any required check failed, and `unavailable` when proof could not be produced. Never treat skipped or missing verification as success.
