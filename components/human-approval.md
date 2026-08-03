---
id: human-approval
name: Human approval
description: Pause execution and request a focused decision from a person.
kind: human
icon: user-check
color: rose
version: 1.0.0
tags: approval, human
inputs: summary, artifacts
outputs: verdict, feedback
---

Pause the workflow and present the reviewer with:

- the decision being requested;
- a concise summary of the work;
- links to the relevant artifacts;
- the consequence of approving or requesting changes.

Allow `approve`, `revise`, and `cancel` responses.
