# Agent Management

**Relay** is a visual, file-first workspace for composing reusable agent instructions into auditable workflows.

The board is the editor, and the repository is the database. Components are Markdown; modules, templates, workflows, and catalysts are JSON. A workflow connects agents, judges, tools, decision gates, and human approvals; project bindings customize those components without forking their shared instructions. Platform primitives such as Catalyst entrypoints appear on the same canvas but are configured and operated by Relay rather than prompted as agents.

![Relay workspace dashboard](docs/relay-dashboard.png)

## Run locally

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

```bash
pnpm check        # tsc -b && eslint . && vitest run
pnpm test         # vitest run
pnpm build
```

## Assets live in the repository

When the dev server is running, a filesystem bridge makes these directories the source of truth. Edit them by hand, with an agent, or in the app — all three see the same state, and the app writes every change straight back.

```text
components/<id>.md      One job an agent performs (Markdown + frontmatter)
modules/<id>.json       A reusable graph of components behind a public contract
templates/<id>.json     A starting point that carries the assets it needs
workflows/<id>.json     A portable workflow document
catalysts/<id>.json     A workflow entrypoint definition
```

The header shows **Repo files** when the bridge is live and **Browser only** for a static build, where the app falls back to `localStorage`. Files that cannot be parsed are counted and named rather than skipped silently.

## What is working

**Authoring**

- Draggable, connectable canvas with zoom, pan, minimap, snap-to-grid, and deletion
- Markdown-backed components with a guided creator: role, icon, accent, and live board preview
- JSON-backed reusable modules that preserve internal graphs, routes, loops, and handoffs behind a public input/output contract, composed on their own canvas
- Modules can be expanded into a detached, editable copy without changing the source module
- Saved workflows exposed as reusable nested-workflow nodes
- Transitions as first-class objects: label, trigger (`always` / `condition` / `human`), handoff (`signal` / `summary` / `full`), and an explicitly bounded loop policy
- Per-node instruction, model, reasoning-effort, and tool overrides with visible inherited values
- Parallel review branches, labeled decision routes, and a visible revision loop
- Project configuration for directory, branch, runtime defaults, tool allowlist, permission ceiling, and variables
- JSON-backed templates plus persisted user templates with private/published visibility; a template captures a whole saved graph and the components and modules it uses, so it works on an empty install
- Import of agent-authored components, modules, and templates, arriving flagged `needs-review` until opened and saved
- A copyable authoring spec to hand an agent so what it writes imports cleanly

**Entrypoints**

- Catalyst definitions for signed webhooks, connector events, runner-managed cron, and secure queries, authored from guided fields rather than cron or event syntax
- Catalyst definitions are files, so the receiver process that authenticates events can read them
- A catalyst is configured on its own and attached to a workflow later from a Catalyst node
- Graph rules are enforced in the app and the CLI: at most one Catalyst, declared as `entry.nodeId`, no incoming transitions, and every executable component reachable from it
- Workflows without a Catalyst stay manually started

**Handoff and observation**

- Driver-ready `.relay.json` assignment bundles with the embedded Markdown, modules, loop policies, permissions, and driver limits a run needs
- A specification preflight that writes `run-spec.json` from the objective, project evidence, and template adaptation rules before graph execution, leaving the reusable workflow unchanged
- Task-first run staging with guided, adaptive, and full-autonomous modes plus optional time and cost budgets
- Split-view control room: execution graph on one side, live agent and tool stream on the other
- Live runner attachment over the loopback observer API — SSE events, `Last-Event-ID` resume, capability token kept in the tab, and pause/resume/cancel controls
- User-arranged multi-run boards with codebase sections and honest connection states

**Everything else**

- A `relay-workflow` CLI for agents: create, inspect, add-node, connect, validate, stage
- A `relay-mock-runner` that implements the observer API so the control room can be exercised before a real driver exists
- Defensive persistence: malformed or unavailable storage degrades per item instead of discarding a library
- Bounded, schema-aware imports that reject duplicate nodes, broken edge references, and oversized graphs
- Keyboard-safe dialogs, component search, and persistent dark and light themes
- Tests over the schema guards, asset parsing, persistence, the CLI, the dev bridge, and the observer transport

Relay implements authoring, handoff, persisted catalogs, and the live-observation contract. **There is no execution engine here.** Until a Relay driver is connected, the Runs page stays in an honest waiting or empty state rather than fabricating execution data, and a catalyst waits for a receiver rather than pretending to fire.

## The core idea

A component is a versioned Markdown instruction with metadata:

```md
---
id: visual-judge
name: Visual judge
description: Inspects a rendered interface and returns a verdict.
kind: judge
icon: eye
color: violet
version: 1.1.0
tags: review, visual
---

Inspect the rendered result at `{{preview.url}}`. Compare it against the brief,
then return a verdict and prioritized findings.
```

A workflow references that component and adds only instance-specific configuration. At run time, Relay compiles the final instruction using this precedence:

```text
component instruction
  → project context + runtime defaults
    → workflow node prompt/model/tool overrides
      → run objective and temporary policy
```

That makes reuse practical: improving `visual-judge.md` improves every workflow that uses it, while a project can still define its own preview URL, commands, tolerance, repository instructions, and task.

What crosses a step boundary is decided per transition, not declared as a port contract on the component. The same review component can receive a briefing in one workflow, everything in another, and wait for human approval in a third without forking its Markdown.

## Authoring with an agent

Everything is a file, so an agent needs no access to the canvas. Use the CLI for safe graph edits:

```bash
pnpm relay create workflows/review.json --name "Review loop" --project-root "$PWD"
pnpm relay add-node workflows/review.json --id implement --name Implement --component scoped-implementation
pnpm relay add-node workflows/review.json --id review --name Review --component request-verification --kind judge
pnpm relay connect workflows/review.json --from implement --to review --handoff summary
pnpm relay connect workflows/review.json --from review --to implement --label revise --condition "route == revise" --loop 3
pnpm relay validate workflows/review.json
```

The CLI rejects unknown kinds, duplicate ids, dangling transitions, unbounded loops, and invalid catalyst entrypoints — the same rules the app enforces, so a graph that validates here loads there. Changes appear in an open page immediately. See [AI workflow authoring](docs/AI-WORKFLOW-AUTHORING.md).

## Watching a run

The driver exposes a loopback observer API. To exercise the control room without one:

```bash
node bin/relay-mock-runner.mjs --run <run-id> --port 4317 --nodes implement,review
```

Stage a workflow, start it from **Runs → Staged**, then paste the printed observer URL and token into the run's connect form. The board renders only received events; the token stays in the tab and is never saved. See [Driver protocol](docs/DRIVER-PROTOCOL.md).

## Repository map

```text
components/  modules/  templates/  workflows/  catalysts/   Repository-backed assets
bin/relay-workflow.mjs      Agent-facing graph authoring CLI
bin/relay-mock-runner.mjs   Observer-API fixture for the control room
vite-plugin-relay-fs.mjs    Dev filesystem bridge for the asset directories
src/App.tsx                 Workspace shell, persistence, and the builder
src/components/             Canvas, node, edge, library, inspector, and run board UI
src/lib/assets.ts           Component Markdown parsing and asset import
src/lib/validation.ts       Runtime schema guards for every asset kind
src/lib/workspaceFiles.ts   Read and mirror the repository asset directories
src/lib/storage.ts          Safe local persistence boundary
src/types/                  Typed component, workflow, and catalog contracts
tests/                      CLI, dev bridge, and observer-transport tests
docs/PRODUCT.md             Product thesis, primitives, and roadmap
docs/ARCHITECTURE.md        Execution model and technical boundaries
docs/DRIVER-PROTOCOL.md     Driver handoff, event stream, and live UI contract
docs/*.schema.json          Workflow, assignment, and catalyst schemas
```

## Design principles

1. **Files over hidden configuration.** Components and workflows should diff, review, branch, and merge with the project.
2. **Composition over giant prompts.** Small instructions with explicit contracts are easier to test and reuse.
3. **Control flow must be inspectable.** Branch conditions, loop limits, and human pauses are visible — not buried in prose.
4. **Artifacts are first-class.** Patches, screenshots, findings, and approvals travel on edges and remain attached to a run.
5. **Execution is replaceable.** The workflow format should compile to local Codex/Claude tooling, CI, or a hosted runner without changing the board.
6. **Never fabricate state.** The UI derives run state from received events only. An empty board says so.

## Next build slice

A local execution daemon: resolve Markdown components, validate variables, execute ready nodes concurrently, persist artifacts and events, and stream live state to the Runs control room over the observer API the mock runner already speaks. See [Product framework](docs/PRODUCT.md), [Architecture](docs/ARCHITECTURE.md), and [Driver protocol](docs/DRIVER-PROTOCOL.md).

![Codebase-wide run monitoring concept](docs/run-monitoring-concept.png)

## License

MIT
