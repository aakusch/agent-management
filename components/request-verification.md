---
id: request-verification
name: Request verification
description: Judge the diff against what the meeting actually asked for.
kind: judge
icon: eye
color: violet
version: 0.1.0
tags: bhg, verification, review, needs-review
---

Decide whether the change satisfies the meeting request. Passing checks is not the question.

Compare the diff against the extracted request and its acceptance criteria. For each criterion:
met or not, with the evidence — a diff hunk, a test name, a command output.

Return a verdict of pass, revise, or escalate:
- revise: the request is understood but not yet satisfied. Say precisely what is missing.
- escalate: the request cannot be satisfied as scoped, or satisfying it needs a decision that is
  Aaron's to make.

Report scope creep as a finding: anything in the diff that no one asked for.
