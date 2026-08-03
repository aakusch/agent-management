# Product framework

## Thesis

Teams do not only need “more agents.” They need a comprehensible way to encode how agents collaborate, how quality is judged, when work loops, and where a human retains authority.

Relay treats agent work as a graph made from reusable, versioned instructions. The immediate wedge is software delivery—implementation, tests, code review, visual review, and pull-request handoff—but the primitives also fit research, content, operations, and data work.

## Product primitives

| Primitive | Purpose | Example |
| --- | --- | --- |
| Component | Reusable instruction and I/O contract | Code review |
| Node | Configured component instance | Review only security-sensitive files |
| Edge | Artifact flow plus optional condition | `verdict == revise` |
| Router | Deterministic branch selection | Pass / revise / blocked |
| Loop | Explicit return edge with a bound | Revise up to 3 times |
| Project binding | Repository-specific variables and permissions | test command, design URL |
| Artifact | Immutable output from a node attempt | patch, screenshot, verdict |
| Run | Event log for one workflow execution | UI quality run #184 |
| Blueprint | Reusable subgraph with exposed inputs/outputs | Review fan-out |

## Component customization

Customization is layered rather than copied. Each layer contributes a small patch:

1. Component defaults define portable behavior.
2. A workspace profile defines team-wide policy, preferred models, and tool allowlists.
3. Project context binds repository facts such as commands, paths, and instructions.
4. Node overrides explain the role of this instance in this workflow.
5. Run inputs provide the task and ephemeral artifacts.

The compiled instruction should be previewable before execution. Relay must show where every value came from and warn on unresolved variables.

Components use semantic versions. A workflow pins a version or version range; upgrades show an instruction diff and require acceptance when the contract changes.

## Workflow semantics

### Readiness

A node becomes ready when every required input is present and its inbound control conditions are satisfied. Independent ready nodes may run concurrently.

### Decisions

Routers consume structured output and select named edges. Conditions belong to edges as a small, deterministic expression—not natural-language interpretation. A router must define a fallback route.

### Loops

Cycles are legal only when explicitly marked as loops. Every loop requires:

- `max_iterations`;
- a state reset/retention policy;
- an exhaustion route;
- visible iteration history.

This prevents an appealing diagram from becoming an unbounded token sink.

### Human checkpoints

A human node pauses rather than polls. It presents a focused decision, relevant artifacts, and the consequences of each response. Approval events are immutable run artifacts.

## Product surfaces

### 1. Builder

The canvas shown in the MVP: component library, graph editing, node inspector, variables, templates, validation, and a compiled-instruction preview.

### 2. Run view

The same graph becomes an execution trace. Nodes show queued/running/passed/failed states, attempts, cost, duration, artifacts, and logs. Selecting an edge explains the condition and the payload it carried.

### 3. Library

Searchable components and blueprints from the repository, workspace, or an optional registry. Users can compare versions, inspect tests, and see where a component is used.

### 4. Projects

Bindings for repository root, branch/worktree strategy, instruction files, commands, secrets, tool permissions, preview environments, and model budgets.

## MVP boundary

The current repository is an authoring prototype. A credible execution MVP adds:

- local runner process;
- schema validation and graph validation;
- SQLite run/event/artifact store;
- one agent adapter and one shell-tool adapter;
- concurrency scheduling;
- bounded loops and retries;
- explicit permissions before mutation;
- resumable human approval.

Defer multi-user collaboration, a public marketplace, cloud scheduling, billing, and enterprise policy until local workflows are genuinely useful.

## A practical first user journey

1. Open a repository and detect its instruction files and package commands.
2. Start from the “UI quality loop” blueprint.
3. Bind the preview URL and visual tolerance.
4. Preview the compiled instructions and resolve missing variables.
5. Run implementation and parallel reviews.
6. Watch visual failure route back to implementation with the finding attached.
7. Approve the final summary and export it to a pull request.

## Success measures

- Time from repository selection to first valid workflow run
- Percentage of components reused without copying source
- Human interventions per successful run
- Loops exhausted versus resolved
- Cost and duration compared with the same work in a single agent session
- Review findings that survive to the final artifact

The north-star behavior is not maximum autonomy. It is reliable reuse: a team encodes a good working pattern once and can understand, adapt, and trust it later.

## Roadmap

### Phase 1 — Authoring foundation

File discovery, schema validation, graph validation, blueprint extraction, component/version diffing, and compiled previews.

### Phase 2 — Local execution

Runner daemon, adapters, artifact store, concurrent scheduling, retries, bounded loops, and human pauses.

### Phase 3 — Evaluation

Fixture-based component tests, judge calibration, replay, run comparison, budgets, and regression detection.

### Phase 4 — Collaboration

Shared library, signed releases, project policies, audit logs, roles, and remote workers.
