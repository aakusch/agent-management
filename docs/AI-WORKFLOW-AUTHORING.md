# AI workflow authoring

Relay workflows are ordinary, versionable files. An agent can create and change them without manipulating the visual canvas.

```text
components/<id>.md      One job an agent performs
modules/<id>.json       A reusable graph of components with a public contract
templates/<id>.json     A starting point that carries the assets it needs
workflows/<id>.json     The workflow document
catalysts/<id>.json     A workflow entrypoint definition
.relay/runs/staged/<run-id>.json
```

While `pnpm dev` is running, the app reads these directories and writes every change back to them, so a file an agent edits appears in the open page immediately and a graph built on the canvas is on disk without an export step.

The workflow document is the semantic source of truth. Node positions are presentation hints; the CLI assigns them automatically. Component instructions stay in Markdown and are referenced by each node's `templateId`. The website reads the JSON for visual review and exports a complete `*.relay.json` assignment for a driver — that export is a download, not a repository asset, since a bundle sitting in `workflows/` would claim the same id as the document it wraps.

## Agent tool

From this repository, use `pnpm relay <command>`:

```bash
pnpm relay create workflows/review.json --name "Review loop" --project-root /absolute/repo
pnpm relay add-node workflows/review.json --id implement --name Implement --component scoped-implementation
pnpm relay add-node workflows/review.json --id review --name Review --component request-verification --kind judge
pnpm relay connect workflows/review.json --from implement --to review --handoff summary
pnpm relay connect workflows/review.json --from review --to implement --label revise --condition "route == revise" --loop 3
pnpm relay validate workflows/review.json
pnpm relay stage workflows/review.json --objective "Fix the failing checkout flow"
```

The supported commands are `create`, `inspect`, `add-node`, `connect`, `validate`, and `stage`. Flags accept both `--key value` and `--key=value`.

Every command refuses to write a graph the app would then refuse to load, which is the point of using it over hand-editing:

- `--kind` must be one of `agent`, `judge`, `router`, `human`, `tool`, `module`, `workflow`, `catalyst`; `--kind module` also requires `--module <module-id>`.
- `--handoff` must be `summary`, `full`, or `signal`.
- `--loop` must be a whole number of passes, 1 or more — an unbounded or unparsable loop is rejected rather than written as a loop with no real bound.
- Adding a `catalyst` node declares it as `entry.nodeId`; nothing may be connected into it, and a second catalyst is refused.
- Duplicate node and transition ids, dangling endpoints, and non-finite positions are refused.
- `stage` validates the whole graph first and rejects run policies it does not recognize.

To start a catalyst-entry workflow, pair the graph with a definition in `catalysts/<id>.json` and attach it from the Catalyst node in the builder. Nothing fires until a receiver is connected and authorized.

Built-in components, Modules, and templates are ordinary assets in the repository rather than TypeScript constants. An agent can author a module JSON with internal nodes, transitions, entry/exit nodes, and a public contract, then reference it with `add-node --kind module --module <module-id>`. Staging always creates a pending Phase 0 specification artifact so project- and objective-specific choices accompany the reusable workflow instead of mutating it.

## Run monitoring

The driver writes `.relay/runs/<run-id>/events.jsonl` and exposes the loopback observer API described in [DRIVER-PROTOCOL.md](DRIVER-PROTOCOL.md). In Relay, open **Runs → Running → a workflow**, enter the observer URL and short-lived token printed by the CLI, and connect. The browser renders only received SSE events; the token remains in the open tab and is not saved with the workflow. Pause, resume, and cancel are ordinary authenticated POSTs to the same run.

To exercise the control room before a driver exists, run the observer-API fixture:

```bash
node bin/relay-mock-runner.mjs --run <run-id> --port 4317 --nodes <first-node-id>,<second-node-id>
```

It executes nothing. It binds loopback-only, mints a capability token, streams a scripted `relay-events-v1` run, honours the control verbs, and replays only the gap after `Last-Event-ID` on reconnect. Pass the graph's real node ids with `--nodes` so the board can highlight them.
