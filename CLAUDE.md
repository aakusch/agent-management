# Relay — working notes for agents

Relay is a visual authoring surface for agent workflows. **There is no execution engine here.** The
repository directories are the database; the app is one of three editors (hand, agent, UI) over them.

## The contract that keeps the three editors honest

`components/*.md`, `modules/*.json`, `templates/*.json`, `workflows/*.json`, `catalysts/*.json` are
read and written by the dev bridge (`vite-plugin-relay-fs.mjs`) and by `bin/relay-workflow.mjs`.
Three rules follow from that, and breaking any of them loses user work silently:

1. **Never persist a document the loader will reject.** `isWorkflowDocument` filters on read, so a
   stored-but-invalid graph disappears on the next boot while its list record survives — the workflow
   then opens as an empty canvas. `persistenceProblem()` in `src/lib/graph.ts` is the exact set of
   loader-fatal rules; the builder blocks the save on it and `App.saveWorkflow` re-checks as a
   backstop. Add a rule to `isWorkflowDocument` → add it to `persistenceProblem` in the same commit.

2. **`bin/relay-workflow.mjs validate` must mirror the app's loader.** It is what agents run. A graph
   that passes there and fails here is a graph the builder throws away.

3. **Read stored collections per item, never per array.** `readStoredItems` + a single-item guard from
   `src/lib/validation.ts`. A whole-array guard means one asset written by an older build discards the
   user's entire library. Every catalog guard lives in `validation.ts` for this reason — don't inline
   a looser copy at the call site.

## Serialized documents carry no runtime state

`serializeDocument` strips React Flow's `measured` / `selected` / `dragging` / `width` / `height`.
Without that, opening a workflow and saving it rewrote the file with viewport noise and a `git diff`
looked like a real edit. A save should change `updatedAt` and nothing else.

## The workspace project vs. the document's project

There is one workspace-level project, and until it is connected (`project.root === ''`) it is an empty
seed. A document carries its own `project` block, which an agent or the CLI may have authored.
`documentForExport` keeps the document's block whenever the workspace has no project connected —
writing the seed over it wiped variables, effort, and permissions on every save.

**Known limitation:** with a project connected, saving still replaces the document's project block
with the workspace one. Per-document project binding is unresolved, not decided.

## Verification

`pnpm check` = `tsc -b && eslint . && vitest run`. Tests cover the schema guards, asset parsing,
persistence, the CLI, the dev bridge, and the observer transport.

Typecheck is not verification for UI work. Run `pnpm dev` and drive the real app — the pages are
`#/dashboard`, `#/builder`, `#/components`, `#/projects`, `#/templates`, `#/runs`. `bin/relay-mock-runner.mjs`
implements the observer API, so the Runs control room can be exercised without a driver.

## Conventions worth not rediscovering

- Ids follow names through `uniqueId()`: never let a punctuation-only name yield `''`, and never let a
  duplicate name overwrite an existing asset.
- `instanceId()` carries a counter because `Date.now()` alone collides during drag-drop bursts, and
  duplicate ids make React Flow drop elements.
- Nothing is bundled in `src/data/` except `platformComponents` (the Catalyst), which Relay operates
  rather than prompts. There is no seeded component or module library.
- The dev bridge refuses cross-origin writes (`isSameOrigin`). It writes into the repository, and any
  page in the browser can reach a dev server on localhost.
- Deleting an asset reports what points at it first (`componentUsage` / `moduleUsage` / `catalystUsage`).
- The Runs page stays in an honest waiting state rather than fabricating execution data.
