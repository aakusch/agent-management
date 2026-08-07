---
id: test-suite
name: Test suite
description: Run the tests covering the change, then the full suite.
kind: tool
icon: terminal
color: amber
version: 0.1.0
tags: bhg, verification
---

Run tests in two passes: first the tests covering the changed surface, then the full suite.

Report per pass: the exact command, counts, and every failure with its file, test name, and assertion.

If the change has no covering test, say so explicitly and name the test that should exist. A green
run over untested code is not evidence.
