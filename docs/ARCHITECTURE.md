# Architecture

## Boundary first

Relay has three separable layers:

```text
Markdown components + workflow JSON
                ↓ compile
      execution plan + policy
                ↓ run
 adapters → event log → artifacts
                ↑
        board / run inspector
```

The repository currently implements the authoring and observation surfaces. The browser stores drafts locally, imports/exports a typed assignment bundle, and exposes honest empty, waiting, and event-driven run states. It does not fabricate execution or execute arbitrary commands.

## Source formats

### Component

The Markdown body is the instruction template. Frontmatter is machine-readable identity and contract data. Future fields should include:

```yaml
id: visual-judge
version: 1.1.0
kind: judge
inputs: [screenshot, brief]
outputs: [verdict, visual_findings]
runner:
  adapter: codex
  model: inherit
tools: [browser.read, browser.screenshot]
timeout: 300s
```

Instructions may reference variables with `{{path.to.value}}`. Compilation resolves each variable by precedence, records provenance, and fails before execution when a required value is absent.

### Workflow

The saved workflow contains project bindings, node positions, component references/overrides, and conditional edges. View data can travel with the workflow without affecting execution semantics.

Edges are first-class transitions. Their routing trigger, condition, priority, delay, blocked behavior, payload selection, and loop policy belong to the workflow connection—not to either reusable component. This lets the same review component receive full artifacts in one workflow, a summary in another, and wait for human approval in a third without forking its Markdown source.

The transition boundary is intentional:

- Components declare capabilities, instructions, and input/output contracts.
- Node instances declare project-specific overrides.
- Transitions declare when execution moves and which outputs cross that boundary.
- Run configuration declares temporary operator policy for one invocation.

See [`workflow.schema.json`](workflow.schema.json) and the example in [`../workflows/ui-quality-loop.json`](../workflows/ui-quality-loop.json).

### Assignment bundle

The handoff artifact is a self-contained `*.relay.json` file with kind `relay.assignment`. It embeds the workflow, the exact Markdown components it references, and driver policies. See [`assignment.schema.json`](assignment.schema.json), the generated [`../workflows/ui-quality-loop.relay.json`](../workflows/ui-quality-loop.relay.json), and the full [`DRIVER-PROTOCOL.md`](DRIVER-PROTOCOL.md).

## Proposed runtime

### Compiler

1. Load and validate component frontmatter.
2. Validate node and edge references.
3. Detect cycles; reject any cycle without explicit loop policy.
4. Resolve component versions.
5. Merge project context and overrides.
6. Validate variable completeness and input/output compatibility.
7. Emit an immutable execution plan.

### Scheduler

The scheduler is event-driven. It derives ready nodes from completed attempts and available artifacts, leases work to adapters, and appends state transitions to an event log. It never mutates prior events.

Suggested node attempt states:

```text
pending → ready → running → succeeded
                     ├────→ failed → retrying
                     └────→ waiting_for_human
```

For merge nodes, readiness policy is explicit: `all`, `any`, or `quorum`. For fan-out, downstream nodes receive immutable references to the same artifact rather than copied content.

### Adapters

Adapters translate an execution-plan node into a concrete runtime call. Start with narrow interfaces:

- `AgentAdapter`: prompt + context + tool policy → structured result
- `ShellAdapter`: allowlisted command + cwd → process result
- `HumanAdapter`: approval request → resumable response

Adapters emit normalized token, cost, duration, logs, and artifacts. Provider-specific data can remain in an `extensions` envelope.

### Persistence

SQLite is sufficient for the local-first milestone:

- `runs`
- `node_attempts`
- `events`
- `artifacts`
- `approvals`

Large artifacts live on disk by content hash; SQLite stores metadata and relationships. A run can be reconstructed entirely from its plan and event stream.

The runner streams the same append-only events to the UI over a loopback Server-Sent Events endpoint. The visual control room is therefore a projection of durable run state, while the CLI driver remains the executor.

## Safety model

Project bindings declare capabilities, not credentials. Secrets are referenced by logical name and resolved by the runner from the OS keychain or environment at execution time.

Each node receives the smallest tool allowlist it needs. Mutating commands, network access, publishing, and human messaging should be separately visible permissions. A workflow cannot widen a project policy; it can only narrow it.

## Validation rules worth enforcing early

- Unique component and node IDs
- Every edge endpoint exists
- Every required input has exactly one compatible source unless declared as a collection
- Every router has a fallback edge
- Every cycle has `max_iterations` and an exhaustion route
- No secret literal appears in exported workflow JSON
- Node override fields are permitted by the component contract
- Pinned component versions exist and satisfy the expected output schema

## Current frontend

- React + TypeScript + Vite
- React Flow for the graph interaction model
- Markdown discovery through Vite raw imports
- Local storage for explicit saves
- JSON files for portability

React Flow supplies dragging, zooming, selection, connection handles, and graph primitives, which lets this repository focus on Relay’s domain model. Its official quick start documents the same Vite integration used here: [React Flow quick start](https://reactflow.dev/learn).
