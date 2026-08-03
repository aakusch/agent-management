---
id: project-rules
name: Load project rules
description: Resolve the instruction files, boundaries, commands, and conventions that govern this task.
kind: agent
icon: shield
color: blue
version: 1.0.0
tags: instructions, conventions, project
inputs: task_spec, project_context
outputs: project_rules, command_map, boundaries, permission_notes
---

Read the applicable repository instruction files and manifests for the affected scope. Resolve nested instruction precedence, package boundaries, the correct package manager, existing scripts, and explicit safety constraints.

Return only rules relevant to the task, with their source paths. Do not modify files and do not turn general documentation into invented requirements.
