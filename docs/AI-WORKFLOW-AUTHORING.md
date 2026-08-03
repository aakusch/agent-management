# AI workflow authoring

Relay workflows are ordinary, versionable files. An agent can create and change them without manipulating the visual canvas.

```text
.relay/
  components/*.md
  workflows/<name>/workflow.json
  runs/staged/<run-id>.json
```

`workflow.json` is the semantic source of truth. Node positions are presentation hints; the supplied CLI assigns them automatically. Component instructions stay in Markdown and are referenced by each node's `templateId`. The website imports the JSON for visual review and exports a complete `*.relay.json` assignment for a driver.

## Agent tool

From this repository, use `npm run relay -- <command>`:

```bash
npm run relay -- create .relay/workflows/review/workflow.json --name "Review loop" --project-root /absolute/repo
npm run relay -- add-node .relay/workflows/review/workflow.json --id implement --name "Implement" --component implement-ui
npm run relay -- add-node .relay/workflows/review/workflow.json --id review --name "Review" --component code-review --kind judge
npm run relay -- connect .relay/workflows/review/workflow.json --from implement --to review
npm run relay -- connect .relay/workflows/review/workflow.json --from review --to implement --label revise --condition "route == revise" --loop 3
npm run relay -- validate .relay/workflows/review/workflow.json
npm run relay -- stage .relay/workflows/review/workflow.json --objective "Fix the failing checkout flow"
```

The supported commands are `create`, `inspect`, `add-node`, `connect`, `validate`, and `stage`. They fail on missing nodes, duplicate identifiers, invalid catalyst entrypoints, or invalid graphs. This makes them suitable as structured terminal tools for an agent while leaving the JSON open for direct editing when necessary.

## Run monitoring

The driver writes `.relay/runs/<run-id>/events.jsonl` and exposes the loopback observer API described in [DRIVER-PROTOCOL.md](DRIVER-PROTOCOL.md). In Relay, open **Runs → Running → a workflow**, enter the observer URL and short-lived token printed by the CLI, and connect. The browser renders only received SSE events; the token remains in the open tab and is not saved with the workflow.
