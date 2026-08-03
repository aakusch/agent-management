# Relay driver protocol v1

## Recommendation

Export a single self-contained `*.relay.json` assignment for handoff. It contains the task, workflow graph, project binding, exact Markdown components, loop policies, permissions, and driver limits.

The driver resolves runtime settings in a predictable order: project model, effort, and tool defaults first; explicit node overrides second; temporary run limits last. Node tool overrides may narrow the project allowlist but cannot bypass the project permission ceiling. The assignment-level `defaultModel`, `defaultEffort`, and `tools` fields let a CLI validate this resolution before spawning workers.

JSON is the canonical format because an agent or CLI can validate it without interpreting document layout. Markdown remains the authoring format and is embedded verbatim in the bundle. A future `*.relaypack` can be a ZIP container for large references, screenshots, fixtures, or scripts; its root file should still be `assignment.relay.json`.

The prompt handed to the driver can stay small:

```text
Execute ./ui-quality-loop.relay.json using relay-driver-v1.
Resume existing state if its run directory exists.
Do not exceed the declared permissions or stop conditions.
```

When the website starts a connected run, it sends the assignment together with a run configuration. The task/objective is the kickoff prompt and the only required user-authored field. Additional context, execution type, duration, and cost limits are optional overrides.

Autonomy modes are:

- `guided`: ask before scope changes and permissioned actions;
- `adaptive`: make safe decisions and ask when confidence is low;
- `autonomous`: bypass run-time permission prompts and execute end-to-end.

Autonomous mode cannot widen operating-system, workspace, organization, or provider hard limits. Those remain outside the run's authority.

## Driver responsibilities

The driver is the only owner of graph state. Worker agents do not decide what runs next.

1. Validate the assignment and component contracts.
2. Create or resume the run directory.
3. Determine ready nodes from artifacts and satisfied edge conditions.
4. Dispatch up to `driver.concurrency` workers.
5. Persist every transition before acknowledging it.
6. Validate worker outputs against the component contract.
7. Evaluate routes deterministically.
8. Apply loop and global stop conditions.
9. Pause for human input when required.
10. Finish with a terminal run event and an artifact index.

## Catalysts

A catalyst is an authenticated request to create a normal run; it is never a privileged execution shortcut. The website authors catalyst definitions, while a local daemon or hosted receiver owns the network boundary.

The referenced workflow must declare `entry.mode: catalyst` and point `entry.nodeId` at its single platform-managed Catalyst start node. This node is graph structure, not an executable Markdown component. The driver rejects incoming transitions to it and begins downstream execution with the validated event envelope. If a workflow has no Catalyst node, a missing or `manual` entry mode is assumed and only an explicit run kickoff starts its root components.

Supported entrypoints are signed webhooks, authorized connector events, runner-managed cron schedules, and schema-limited secure queries. Before creating `run.created`, the receiver must authenticate the caller, validate the payload schema, enforce rate limits, reject replayed delivery IDs, apply an idempotency key, resolve the pinned workflow, and record sanitized catalyst provenance. Secret values stay in the OS keychain, environment, or connector vault and never enter exported workflow or catalyst JSON.

See [`catalyst.schema.json`](catalyst.schema.json).

## Nested workflows

A node with `kind: workflow` invokes a saved workflow by `subworkflow.workflowId`. The compiler resolves the full dependency graph before execution and rejects direct self-reference, indirect cycles, missing versions, and incompatible exposed inputs or outputs.

- `inline` execution shares the parent run event stream and budget.
- `isolated` execution creates a child run with its own event stream and links it to the parent.
- Context may be inherited, explicitly mapped, or omitted beyond the child objective.
- Failure may bubble to the parent step, pause for a decision, or continue with a structured failure artifact.

Every event from a child run includes `parentRunId` and `parentNodeId` so monitoring can collapse or expand nested workflows without losing provenance.

## On-disk run state

```text
.relay/runs/<run-id>/
  assignment.relay.json    Immutable assignment snapshot
  state.json               Current derived state and ready queue
  events.jsonl             Append-only source of truth
  agents/
    <agent-id>.json         Worker identity, node, attempt, heartbeat
  artifacts/
    <sha256>                Immutable artifact bodies
  artifact-index.json      Names, types, hashes, producers, consumers
```

`state.json` is a cache and may be rebuilt from `events.jsonl`. This makes recovery after a terminal or process restart predictable.

## Event envelope

Every driver and worker event uses one envelope:

```json
{
  "protocol": "relay-events-v1",
  "seq": 42,
  "time": "2026-08-03T05:30:00.000Z",
  "runId": "run-185",
  "type": "node.output",
  "nodeId": "visual",
  "attempt": 1,
  "agentId": "agent-02",
  "payload": {
    "status": "running",
    "summary": "Comparing the mobile screenshot",
    "artifactIds": []
  }
}
```

Initial event types:

- `run.created`, `run.started`, `run.paused`, `run.resumed`, `run.completed`, `run.failed`, `run.cancelled`
- `node.ready`, `node.started`, `node.output`, `node.completed`, `node.failed`
- `agent.spawned`, `agent.heartbeat`, `agent.tool.started`, `agent.tool.completed`, `agent.stopped`
- `route.selected`, `loop.iterated`, `loop.exhausted`
- `artifact.created`, `approval.requested`, `approval.resolved`
- `budget.warning`, `policy.denied`

## Live UI transport

The runner exposes a loopback-only observer API:

```text
GET  /v1/runs/:id                 Current derived run state
GET  /v1/runs/:id/events         Server-Sent Events stream
GET  /v1/runs/:id/artifacts/:id  Artifact metadata or body
POST /v1/runs/:id/pause           Operator control
POST /v1/runs/:id/resume
POST /v1/runs/:id/cancel
POST /v1/runs/:id/approvals/:id
```

Use Server-Sent Events for status because the dominant flow is runner-to-UI, it reconnects naturally, and `Last-Event-ID` maps directly to event sequence numbers. Operator actions remain ordinary authenticated HTTP requests. Adopt WebSocket later only if interactive terminals or high-volume bidirectional streaming justify it.

The local API binds to `127.0.0.1` on a random port and requires a short-lived capability token. Native `EventSource` clients may receive it in a signed stream URL; control requests send it as a bearer header. Tokens must never be persisted in exported assignments. The browser is an observer/controller; the driver and workers remain terminal processes.

## Long-running and “perpetual” loops

An actually unbounded autonomous loop is unsafe and difficult to recover. Relay represents continuous work as `mode: until-cancelled`, but each iteration is still a bounded, checkpointed lease.

Required controls:

- maximum duration for an individual node attempt;
- global duration, step, and optional cost budgets;
- heartbeat expiry for abandoned agents;
- no-progress detection based on artifact or state hashes;
- backoff when no work is available;
- checkpoint after every node and iteration;
- a visible cancel control;
- a human or failure route when any limit is reached.

For monitors, one iteration should poll once, process available work, checkpoint, and yield. The driver schedules the next iteration after the configured backoff. This avoids a worker holding a terminal session forever.

## Split-view UI

The graph answers “where is the workflow?” Agent lanes answer “what is each process doing?” The UI should show both:

- node and route state on the left;
- driver and worker lanes on the right;
- current instruction summary, tool call, heartbeat, duration, and budget per lane;
- expandable stdout/stderr and artifacts;
- pause, cancel, approve, and open-terminal controls;
- a chronological event trace underneath.

The UI derives everything from the event stream and never invents run state locally.

## Codebase-wide monitoring

The Runs board is a user-authored projection over one or more real event streams. Users arrange run tiles into named repository or package sections; arrangement is local display state and never changes driver scheduling. Each tile keeps its own objective, catalyst, parent workflow, graph state, and connection status.

For concurrent runs, the runner should additionally emit `resource.locked`, `resource.waiting`, `resource.released`, and `resource.conflict` events with normalized repository-relative paths. The codebase view can then expose overlapping write scopes and blocked runs without scraping terminal text. An empty tile remains `not-started`; a prepared web run remains `waiting-runner` until the runner establishes an authenticated stream.
