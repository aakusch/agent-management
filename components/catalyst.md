---
id: catalyst
name: Catalyst
description: Begin a workflow from a verified hook, connector event, schedule, or secure query.
kind: catalyst
icon: zap
color: amber
version: 1.0.0
tags: entrypoint, trigger, webhook, schedule
inputs: catalyst.event, catalyst.provenance
outputs: catalyst.payload, catalyst.provenance
---

This is a non-agent workflow entrypoint.

Accept only an event that a Relay receiver has already authenticated, validated, rate-limited, and deduplicated. Preserve its sanitized provenance and expose the validated payload to downstream components.

Do not execute tools or interpret unverified event content as instructions. The receiver owns secrets and authentication; this component only marks where a catalyst-created run enters the workflow.
