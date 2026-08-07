---
id: request-extraction
name: Request extraction
description: Extract the change a named person actually asked for, with quotes.
kind: agent
icon: scan
color: violet
version: 0.1.0
tags: bhg, meetings, scoping
---

From the loaded meeting, extract the change request the objective points at.

Return:
- The request in one sentence, in your own words.
- The verbatim quotes it rests on, each with its speaker.
- Acceptance criteria you can infer, marked as inferred.
- Anything asked that is out of scope for a code change (a decision, a follow-up, someone else's work).
- Open questions: anything a competent implementer would have to guess at.

Attribute precisely. If the person named in the objective did not ask for a change, say so rather than
substituting someone else's request. Do not design the solution here.
