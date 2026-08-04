# Architecture

## Boundary first

Relay has three separable layers:

```text
Markdown components + module/template JSON + workflow JSON
                ↓ compile
      execution plan + policy
                ↓ run
 adapters → event log → artifacts
                ↑
        board / run inspector
```

The repository currently implements the authoring and observation surfaces. Assets live in the repository's `components/`, `modules/`, `templates/`, `workflows/`, and `catalysts/` directories, reached through a dev-only filesystem bridge; a static build falls back to browser storage. The app imports and exports a typed assignment bundle and exposes honest empty, waiting, and event-driven run states. It does not fabricate execution or execute arbitrary commands.

## Source formats

### Component

The Markdown body is the instruction template. Frontmatter is machine-readable identity. Today it carries `id`, `name`, `description`, `kind`, `icon`, `color`, `version`, and a comma-separated `tags` list; every value is single-line, and `id` defaults to the filename. There is deliberately no port contract to declare — what crosses a step boundary is a property of the transition, not the component.

Fields a runtime may add later:

```yaml
runner:
  adapter: codex
  model: inherit
tools: [browser.read, browser.screenshot]
timeout: 300s
```

Instructions may reference variables with `{{path.to.value}}`. Compilation resolves each variable by precedence, records provenance, and fails before execution when a required value is absent.

### Workflow

The saved workflow contains project bindings, node positions, component references/overrides, and conditional edges. View data can travel with the workflow without affecting execution semantics.

Project bindings also declare the default model identifier, reasoning effort, maximum parallel agents, tool allowlist, and permission ceiling. An agent or judge node may override model, effort, or tools for that instance. Missing node values mean inherit; an explicit custom tool array, including an empty array, replaces the project tool defaults. The compiler records the resolved value and its source in the immutable execution plan.

Edges are first-class transitions. Their label, routing trigger, condition, handoff, and loop policy belong to the workflow connection — not to either reusable component. This lets the same review component receive everything in one workflow, a briefing in another, and wait for human approval in a third without forking its Markdown source.

Handoff is one choice rather than a field-by-field manifest, because a per-field payload contract was configuration nobody could verify:

- `signal` — proceed only; the next step starts from the run objective and project context.
- `summary` — the previous agent writes a short brief: what it did, what it decided, what is left.
- `full` — the next step receives the complete result and context of the previous step.

Graphs saved before this simplification carried a `payload` object and a structured `handoff` object; both are collapsed into the single choice on load, and the legacy `delaySeconds`, `onBlocked`, and `priority` keys are dropped.

### Modules and templates

Modules are JSON assets containing a reusable internal graph, explicit entry and exit nodes, and a public input/output contract. Workflows reference a linked module as one node. A user may expand it into a detached editable copy without changing the source module. Templates are also JSON assets and assemble stable modules plus optional adaptation rules.

Every run begins with Specification preflight. It emits `run-spec.json`, an immutable accompaniment that resolves the objective and project evidence into a materialized execution plan. The source template and workflow remain unchanged.

The transition boundary is intentional:

- Components declare their instruction and identity. Inputs and outputs are optional documentation, not an enforced port contract.
- Node instances declare project-specific overrides.
- Transitions declare when execution moves and which outputs cross that boundary.
- Run configuration declares temporary operator policy for one invocation.
- Project configuration declares repository-wide runtime defaults and the maximum permission boundary.
- Agent and judge nodes may narrow or replace their inherited runtime selection for one workflow step.

See [`workflow.schema.json`](workflow.schema.json) and the example in [`../workflows/ui-quality-loop.json`](../workflows/ui-quality-loop.json).

### Assignment bundle

The handoff artifact is a self-contained `*.relay.json` file with kind `relay.assignment`. It embeds the workflow, the exact Markdown components it references, the modules it depends on transitively, and driver policies. Exporting one is a download, not a repository asset — keeping a generated bundle next to the canonical document in `workflows/` makes two files claim the same id. See [`assignment.schema.json`](assignment.schema.json) and the full [`DRIVER-PROTOCOL.md`](DRIVER-PROTOCOL.md).

### Catalyst

Catalysts are separately versioned platform entrypoint definitions, not Markdown instructions or embedded secrets. The composer renders a Catalyst as a component-shaped node because it participates in graph topology, but it has no prompt, model, effort, tools, Contract tab, or Source tab and is not included in the assignment's `components` bundle.

A workflow uses catalyst entry only when its graph starts with one `kind: catalyst` node. That node has no incoming transition and passes the receiver's validated payload and sanitized provenance to the first executable component. Without a Catalyst node, `entry.mode` is `manual` and the driver starts from the graph's ordinary root components.

The authoring app persists a catalyst's type, selector, guided settings, optional target workflow, and required authentication mode to `catalysts/<id>.json`. It is a file rather than browser state for a structural reason: the receiver that authenticates events is a separate process and has to be able to read what the workspace authored. Only workflows with catalyst entry may be selected, and `workflowId` stays optional so a definition can be configured before any workflow claims it. A receiver validates the definition against [`catalyst.schema.json`](catalyst.schema.json), resolves secret references outside the file, and emits a normal `run.created` event with catalyst provenance.

The Catalyst settings UI authors selectors from guided fields rather than requiring cron or event syntax: service/event for hooks, connector/event for subscriptions, cadence/time/timezone for schedules, and request type/access scope for secure queries. The canvas node may bind one of the definitions created for its workflow and toggle that definition between enabled and paused.

### Workflow references

Saved workflows may appear in the component library as `kind: workflow`. A node stores the referenced workflow ID plus execution, context, and failure policies. Compilation recursively resolves these references, validates exposed contracts, and rejects dependency cycles before any agent starts.

## Proposed runtime

### Compiler

1. Load and validate component, module, and template assets.
2. Run Specification preflight and persist `run-spec.json`.
3. Validate node and edge references.
4. Detect cycles; reject any cycle without explicit loop policy.
5. Resolve component and module versions.
6. Merge project context and overrides.
7. Validate variable completeness and input/output compatibility.
8. Emit an immutable execution plan.

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

The runner streams the same append-only events to the UI over a loopback Server-Sent Events endpoint. The visual control room is therefore a projection of durable run state, while the CLI driver remains the executor. `bin/relay-mock-runner.mjs` implements that endpoint without executing anything, so the control room and its operator controls can be exercised — and regression-tested — before the driver exists.

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
- A dev-only Vite middleware (`vite-plugin-relay-fs.mjs`) that reads and writes the asset directories, refusing any path that escapes them or carries an unexpected extension
- Browser storage as the fallback when no bridge is present, validated per item so one bad record cannot discard a library
- Vitest over the schema guards, asset parsing, persistence, the CLI, the bridge, and the observer transport

React Flow supplies dragging, zooming, selection, connection handles, and graph primitives, which lets this repository focus on Relay’s domain model. Its official quick start documents the same Vite integration used here: [React Flow quick start](https://reactflow.dev/learn).
