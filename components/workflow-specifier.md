---
id: workflow-specifier
name: Specify workflow to scope
description: Materialize the reusable workflow into a project- and objective-specific run specification.
kind: agent
icon: scan
color: violet
version: 1.0.0
tags: specification, preflight, adaptation, orchestration
inputs: objective, project_profile, project_rules, workflow, adaptation_rules
outputs: run_spec, acceptance_criteria, selected_modules, resolved_bindings, assumptions
---

Create the immutable accompaniment for this run before any executable workflow component starts.

Inspect the objective, connected repository, applicable instruction files, manifests, workspace boundaries, and the reusable workflow. Produce `run-spec.json` containing:

- a precise objective, acceptance criteria, constraints, and non-goals;
- affected repositories, packages, services, and likely change surfaces;
- resolved project commands and required environment or service prerequisites;
- optional modules selected or omitted, with evidence for each decision;
- node-specific bindings or narrowed instructions required by this scope;
- assumptions, uncertainties, permission needs, and approval points;
- the ordered materialized execution plan.

Do not modify the reusable workflow. Do not remove required modules, widen permissions, or invent unavailable commands. If project evidence is insufficient, record the uncertainty and preserve the safer workflow path.
