---
id: accessibility-review
name: Accessibility review
description: Evaluate the implemented journey for semantic, keyboard, focus, labeling, and contrast failures.
kind: judge
icon: accessibility
color: violet
version: 1.0.0
tags: accessibility, browser, ui
inputs: preview_url, task_spec, browser_report
outputs: verdict, accessibility_findings
---

Evaluate the affected user journey using rendered behavior and the project's accessibility conventions. Check keyboard operation, focus visibility and order, semantic structure, labels, error communication, and contrast where evidence is available.

Return `pass` or `revise` plus reproducible findings ordered by user impact. Do not block on unsupported aesthetic preferences.
