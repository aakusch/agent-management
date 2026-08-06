import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const run = promisify(execFile)
const cli = new URL('../bin/relay-workflow.mjs', import.meta.url).pathname

let workspace: string
let file: string

/** Runs the CLI and returns its streams plus exit code, never throwing on a non-zero exit. */
async function relay(...args: string[]) {
  try {
    const { stdout, stderr } = await run(process.execPath, [cli, ...args], { cwd: workspace })
    return { code: 0, stdout, stderr }
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string }
    return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' }
  }
}

const workflow = async () => JSON.parse(await readFile(file, 'utf8'))

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'relay-cli-'))
  file = join(workspace, 'flow.json')
})
afterEach(async () => { await rm(workspace, { recursive: true, force: true }) })

describe('relay-workflow create', () => {
  it('writes a valid empty workflow', async () => {
    const created = await relay('create', file, '--name', 'Meeting to PR')
    expect(created.code).toBe(0)
    const document = await workflow()
    expect(document).toMatchObject({ schemaVersion: '1.0', id: 'meeting-to-pr', name: 'Meeting to PR', nodes: [], edges: [] })
    expect(document.entry).toEqual({ mode: 'manual' })
    expect((await relay('validate', file)).code).toBe(0)
  })

  it('requires a name that carries a value', async () => {
    expect((await relay('create', file, '--name')).stderr).toMatch(/--name is required/)
    expect((await relay('create', file)).stderr).toMatch(/--name is required/)
  })

  it('refuses a name with nothing to build an id from', async () => {
    expect((await relay('create', file, '--name', '!!!')).stderr).toMatch(/pass --id explicitly/)
  })

  it('accepts --key=value form', async () => {
    await relay('create', file, '--name=Release check', '--project-root=/repo')
    expect((await workflow()).project.root).toBe('/repo')
  })
})

describe('relay-workflow add-node', () => {
  beforeEach(async () => { await relay('create', file, '--name', 'Flow') })

  it('adds a node the app schema accepts', async () => {
    expect((await relay('add-node', file, '--id', 'review', '--name', 'Code review', '--component', 'code-review', '--kind', 'judge')).code).toBe(0)
    const [node] = (await workflow()).nodes
    expect(node).toMatchObject({ id: 'review', type: 'workflow' })
    expect(node.data).toMatchObject({ label: 'Code review', templateId: 'code-review', kind: 'judge', status: 'idle' })
    expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true)
  })

  it('rejects a kind the app would refuse to load', async () => {
    const result = await relay('add-node', file, '--id', 'a', '--name', 'A', '--component', 'c', '--kind', 'wizard')
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/--kind must be one of/)
    expect((await workflow()).nodes).toHaveLength(0)
  })

  it('requires --module for a module node', async () => {
    expect((await relay('add-node', file, '--id', 'a', '--name', 'A', '--component', 'c', '--kind', 'module')).stderr).toMatch(/requires --module/)
  })

  it('declares a catalyst node as the entry, so validate passes', async () => {
    await relay('add-node', file, '--id', 'start', '--name', 'Start', '--component', 'catalyst', '--kind', 'catalyst')
    await relay('add-node', file, '--id', 'review', '--name', 'Review', '--component', 'code-review')
    await relay('connect', file, '--from', 'start', '--to', 'review')
    expect((await workflow()).entry).toEqual({ mode: 'catalyst', nodeId: 'start' })
    expect((await relay('validate', file)).code).toBe(0)
  })

  it('refuses a duplicate node id', async () => {
    await relay('add-node', file, '--id', 'a', '--name', 'A', '--component', 'c')
    expect((await relay('add-node', file, '--id', 'a', '--name', 'A', '--component', 'c')).stderr).toMatch(/already exists/)
  })

  // Why: the app refuses to save these graphs. The CLI has to agree, or an agent writes a workflow
  // the builder then rejects on open.
  it('reports a catalyst that reaches nothing', async () => {
    await relay('add-node', file, '--id', 'start', '--name', 'Start', '--component', 'catalyst', '--kind', 'catalyst')
    await relay('add-node', file, '--id', 'review', '--name', 'Review', '--component', 'code-review')
    const result = await relay('validate', file)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/catalyst must connect to the first executable component/)
  })

  it('reports a component no transition reaches from the catalyst', async () => {
    await relay('add-node', file, '--id', 'start', '--name', 'Start', '--component', 'catalyst', '--kind', 'catalyst')
    await relay('add-node', file, '--id', 'review', '--name', 'Review', '--component', 'code-review')
    await relay('add-node', file, '--id', 'orphan', '--name', 'Orphan', '--component', 'code-review')
    await relay('connect', file, '--from', 'start', '--to', 'review')
    const result = await relay('validate', file)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/reachable from the catalyst.*orphan/s)
  })
})

describe('relay-workflow connect', () => {
  beforeEach(async () => {
    await relay('create', file, '--name', 'Flow')
    await relay('add-node', file, '--id', 'a', '--name', 'A', '--component', 'c')
    await relay('add-node', file, '--id', 'b', '--name', 'B', '--component', 'c')
  })

  it('connects two nodes with a summary handoff by default', async () => {
    expect((await relay('connect', file, '--from', 'a', '--to', 'b')).code).toBe(0)
    expect((await workflow()).edges[0]).toMatchObject({ id: 'a-b', source: 'a', target: 'b', type: 'workflow', data: { handoff: 'summary', trigger: 'always' } })
  })

  it('marks a condition trigger when a condition is supplied', async () => {
    await relay('connect', file, '--from', 'a', '--to', 'b', '--condition', 'verdict == pass')
    expect((await workflow()).edges[0].data).toMatchObject({ trigger: 'condition', condition: 'verdict == pass' })
  })

  it('rejects an unknown handoff', async () => {
    expect((await relay('connect', file, '--from', 'a', '--to', 'b', '--handoff', 'telepathy')).stderr).toMatch(/--handoff must be/)
  })

  it('rejects nodes that do not exist', async () => {
    expect((await relay('connect', file, '--from', 'a', '--to', 'ghost')).stderr).toMatch(/must reference existing nodes/)
  })

  // Regression: `--loop abc` became NaN and a bare `--loop` became 1, so the bound was meaningless.
  it('requires a whole number of loop passes', async () => {
    expect((await relay('connect', file, '--from', 'a', '--to', 'b', '--loop', 'abc')).stderr).toMatch(/--loop must be a whole number/)
    expect((await relay('connect', file, '--from', 'a', '--to', 'b', '--loop', '0')).stderr).toMatch(/--loop must be a whole number/)
    expect((await relay('connect', file, '--from', 'a', '--to', 'b', '--loop', '2.5')).stderr).toMatch(/--loop must be a whole number/)
    expect((await relay('connect', file, '--from', 'a', '--to', 'b', '--loop')).stderr).toMatch(/--loop must be a whole number/)
  })

  it('writes a bounded loop when given a count', async () => {
    await relay('connect', file, '--from', 'b', '--to', 'a', '--loop', '3')
    expect((await workflow()).edges[0].data.loop).toMatchObject({ mode: 'bounded', maxIterations: 3, onExhausted: 'human' })
  })

  it('refuses to route a transition into a catalyst', async () => {
    await relay('add-node', file, '--id', 'start', '--name', 'Start', '--component', 'catalyst', '--kind', 'catalyst')
    expect((await relay('connect', file, '--from', 'a', '--to', 'start')).stderr).toMatch(/cannot receive a transition/)
  })

  it('refuses a duplicate transition id', async () => {
    await relay('connect', file, '--from', 'a', '--to', 'b')
    expect((await relay('connect', file, '--from', 'a', '--to', 'b')).stderr).toMatch(/already exists/)
  })
})

describe('relay-workflow validate', () => {
  it('reports a dangling transition', async () => {
    await relay('create', file, '--name', 'Flow')
    await relay('add-node', file, '--id', 'a', '--name', 'A', '--component', 'c')
    const document = await workflow()
    document.edges.push({ id: 'broken', source: 'a', target: 'ghost', type: 'workflow' })
    await writeFile(file, JSON.stringify(document))
    const result = await relay('validate', file)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/references a missing node/)
  })

  it('reports a file that is not a workflow document', async () => {
    await writeFile(file, '{"hello":"world"}')
    expect((await relay('validate', file)).stderr).toMatch(/is not a Relay workflow document/)
  })

  it('reports unreadable JSON', async () => {
    await writeFile(file, '{oops')
    expect((await relay('validate', file)).code).toBe(1)
  })
})

describe('relay-workflow stage', () => {
  beforeEach(async () => {
    await relay('create', file, '--name', 'Flow')
    await relay('add-node', file, '--id', 'a', '--name', 'A', '--component', 'c')
  })

  it('writes a staged run the Runs board can pick up', async () => {
    const out = join(workspace, 'staged.json')
    expect((await relay('stage', file, '--objective', 'Ship the fix', '--id', 'run-1', '--out', out)).code).toBe(0)
    const staged = JSON.parse(await readFile(out, 'utf8'))
    expect(staged).toMatchObject({
      kind: 'relay.staged-run',
      schemaVersion: '1.0',
      id: 'run-1',
      objective: 'Ship the fix',
      preparedBy: 'agent',
      configuration: { autonomy: 'adaptive', execution: 'execute', specificationMode: 'adaptive' },
      specification: { phase: 0, componentId: 'workflow-specifier', status: 'pending' },
    })
    expect(staged.specification.artifact).toBe('.relay/runs/run-1/run-spec.json')
  })

  it('refuses to stage an invalid graph', async () => {
    const document = await workflow()
    document.nodes[0].data.kind = 'wizard'
    await writeFile(file, JSON.stringify(document))
    expect((await relay('stage', file, '--objective', 'Go')).stderr).toMatch(/workflow is invalid/)
  })

  it('rejects run policies it does not understand', async () => {
    expect((await relay('stage', file, '--objective', 'Go', '--autonomy', 'yolo')).stderr).toMatch(/--autonomy must be/)
    expect((await relay('stage', file, '--objective', 'Go', '--execution', 'maybe')).stderr).toMatch(/--execution must be/)
    expect((await relay('stage', file, '--objective', 'Go', '--specification', 'vibes')).stderr).toMatch(/--specification must be/)
  })

  // Regression: `--out` with no value wrote a file literally named "true".
  it('falls back to the default path when --out carries no value', async () => {
    expect((await relay('stage', file, '--objective', 'Go', '--id', 'run-2', '--out')).code).toBe(0)
    expect(JSON.parse(await readFile(join(workspace, '.relay/runs/staged/run-2.json'), 'utf8')).id).toBe('run-2')
  })

  it('requires an objective', async () => {
    expect((await relay('stage', file, '--objective')).stderr).toMatch(/--objective is required/)
  })
})

describe('relay-workflow help and unknown commands', () => {
  it('prints usage with no arguments', async () => {
    expect((await relay()).stdout).toMatch(/Relay workflow authoring/)
    expect((await relay('--help')).stdout).toMatch(/relay-workflow create/)
  })

  it('reports an unknown command', async () => {
    await relay('create', file, '--name', 'Flow')
    expect((await relay('teleport', file)).stderr).toMatch(/unknown command: teleport/)
  })

  it('requires a file for every command that touches one', async () => {
    expect((await relay('validate')).stderr).toMatch(/a workflow file is required/)
  })
})
