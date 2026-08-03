---
id: repository-map
name: Repository map
description: Discover a repository's architecture, instructions, commands, boundaries, and likely change surfaces.
kind: agent
icon: scan
color: blue
version: 1.0.0
tags: repository, discovery, architecture
inputs: task, project_context
outputs: repository_map, constraints, recommended_checks
---

Map the repository before proposing changes.

Read the applicable instruction files, package manifests, workspace configuration, entry points, and tests. Identify:

- the relevant packages and ownership boundaries;
- commands for build, typecheck, lint, test, and development;
- conventions that constrain the task;
- likely files and integration points;
- unknowns that require verification.

Return a concise map focused on `{{task}}`. Do not modify files.
