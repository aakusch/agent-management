import { describe, expect, it } from 'vitest'
import { isCatalystDefinition, isComponentTemplate, isPendingRun, isRunMonitorBoard, isWorkflowDocument, isWorkflowModuleDefinition, isWorkflowRecord, isWorkflowTemplate, parseWorkflowImport } from './validation'
import type { ProjectContext, WorkflowDocument } from '../types/workflow'

const project: ProjectContext = {
  name: 'Relay',
  root: '/repo',
  branch: 'main',
  variables: {},
  defaults: { model: 'auto', effort: 'medium', maxParallelAgents: 3, tools: ['filesystem', 'git'] },
  permissions: { spawnAgents: true, shell: 'project', network: 'ask', publish: 'ask' },
}

const node = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: {
    label: id, description: '', templateId: 'code-review', kind: 'agent',
    icon: 'bot', color: 'mint', status: 'idle', instruction: 'Go.', overrides: {},
    ...overrides,
  },
})

const document = (overrides: Partial<WorkflowDocument> = {}): unknown => ({
  schemaVersion: '1.0',
  id: 'flow',
  name: 'Flow',
  description: '',
  project,
  nodes: [node('one'), node('two')],
  edges: [{ id: 'one-two', source: 'one', target: 'two', type: 'workflow', data: { handoff: 'summary' } }],
  updatedAt: '2026-08-04T00:00:00.000Z',
  ...overrides,
})

describe('isWorkflowDocument', () => {
  it('accepts a well-formed graph', () => {
    expect(isWorkflowDocument(document())).toBe(true)
  })

  // Regression: node tools used to be cross-checked against the project allowlist, so narrowing the
  // project defaults later silently invalidated — and discarded — every saved graph on load.
  it('accepts a node tool the project defaults no longer allow', () => {
    const withBrowser = document({ nodes: [node('one', { execution: { tools: ['browser'] } })], edges: [] } as never)
    expect(isWorkflowDocument(withBrowser)).toBe(true)
  })

  it('still rejects a tool that is not a Relay tool at all', () => {
    const bogus = document({ nodes: [node('one', { execution: { tools: ['rm-rf'] } })], edges: [] } as never)
    expect(isWorkflowDocument(bogus)).toBe(false)
  })

  it('rejects duplicate node ids', () => {
    expect(isWorkflowDocument(document({ nodes: [node('one'), node('one')], edges: [] } as never))).toBe(false)
  })

  it('rejects an edge pointing at a node that does not exist', () => {
    expect(isWorkflowDocument(document({ edges: [{ id: 'e', source: 'one', target: 'ghost' }] } as never))).toBe(false)
  })

  it('rejects a non-finite position', () => {
    const broken = document({ nodes: [{ ...node('one'), position: { x: Number.NaN, y: 0 } }], edges: [] } as never)
    expect(isWorkflowDocument(broken)).toBe(false)
  })

  it('requires a module node to name its module', () => {
    expect(isWorkflowDocument(document({ nodes: [node('one', { kind: 'module' })], edges: [] } as never))).toBe(false)
  })

  it('allows at most one catalyst, declared as the entry node', () => {
    const catalyst = node('start', { kind: 'catalyst' })
    expect(isWorkflowDocument(document({
      nodes: [catalyst, node('two')],
      edges: [{ id: 'e', source: 'start', target: 'two' }],
      entry: { mode: 'catalyst', nodeId: 'start' },
    } as never))).toBe(true)

    // Undeclared entry, a second catalyst, or an inbound edge are each rejected.
    expect(isWorkflowDocument(document({ nodes: [catalyst, node('two')], edges: [] } as never))).toBe(false)
    expect(isWorkflowDocument(document({ nodes: [catalyst, node('other', { kind: 'catalyst' })], edges: [] } as never))).toBe(false)
    expect(isWorkflowDocument(document({
      nodes: [catalyst, node('two')],
      edges: [{ id: 'e', source: 'two', target: 'start' }],
      entry: { mode: 'catalyst', nodeId: 'start' },
    } as never))).toBe(false)
  })

  it('rejects catalyst entry mode with no catalyst node', () => {
    expect(isWorkflowDocument(document({ entry: { mode: 'catalyst', nodeId: 'one' } } as never))).toBe(false)
  })

  it('refuses graphs beyond the size ceiling', () => {
    const many = Array.from({ length: 501 }, (_, index) => node(`n${index}`))
    expect(isWorkflowDocument(document({ nodes: many, edges: [] } as never))).toBe(false)
  })
})

describe('isComponentTemplate', () => {
  const valid = { id: 'a', name: 'A', description: '', kind: 'agent', icon: 'bot', color: 'mint', version: '1.0.0', tags: [], instruction: 'Go.' }

  it('accepts an authorable component', () => {
    expect(isComponentTemplate(valid)).toBe(true)
  })

  it('rejects the platform-only catalyst kind', () => {
    expect(isComponentTemplate({ ...valid, kind: 'catalyst' })).toBe(false)
  })

  it('rejects non-string tags', () => {
    expect(isComponentTemplate({ ...valid, tags: [1] })).toBe(false)
  })
})

describe('isWorkflowModuleDefinition', () => {
  const valid = {
    id: 'm', name: 'M', description: '', version: '1.0.0', icon: 'layers', color: 'cyan', tags: [], source: 'user',
    nodes: [{ id: 'a', componentId: 'x', position: { x: 0, y: 0 } }, { id: 'b', componentId: 'y', position: { x: 24, y: 0 } }],
    edges: [{ id: 'a-b', source: 'a', target: 'b' }],
    entryNodeIds: ['a'], exitNodeIds: ['b'],
  }

  it('accepts a coherent module', () => {
    expect(isWorkflowModuleDefinition(valid)).toBe(true)
  })

  it('rejects edges and entry/exit ids that leave the module', () => {
    expect(isWorkflowModuleDefinition({ ...valid, edges: [{ id: 'e', source: 'a', target: 'ghost' }] })).toBe(false)
    expect(isWorkflowModuleDefinition({ ...valid, entryNodeIds: ['ghost'] })).toBe(false)
    expect(isWorkflowModuleDefinition({ ...valid, exitNodeIds: ['ghost'] })).toBe(false)
  })

  it('rejects duplicate internal node ids', () => {
    expect(isWorkflowModuleDefinition({ ...valid, nodes: [valid.nodes[0], valid.nodes[0]], edges: [], entryNodeIds: [], exitNodeIds: [] })).toBe(false)
  })
})

describe('parseWorkflowImport', () => {
  it('reads a bare workflow document', () => {
    const parsed = parseWorkflowImport(JSON.stringify(document()))
    expect(parsed.workflow.id).toBe('flow')
    expect(parsed.components).toEqual([])
  })

  it('reads an assignment bundle with its components', () => {
    const bundle = {
      kind: 'relay.assignment',
      schemaVersion: '1.0',
      assignment: { id: 'a', title: 'A', task: '', createdAt: '' },
      workflow: document(),
      components: [{ id: 'a', name: 'A', description: '', kind: 'agent', icon: 'bot', color: 'mint', version: '1.0.0', tags: [], instruction: 'Go.' }],
    }
    const parsed = parseWorkflowImport(JSON.stringify(bundle))
    expect(parsed.components).toHaveLength(1)
  })

  it('explains each way an import can fail', () => {
    expect(() => parseWorkflowImport('{oops')).toThrow(/not valid JSON/)
    expect(() => parseWorkflowImport('{"kind":"relay.assignment","schemaVersion":"9.9"}')).toThrow(/unsupported or incomplete/)
    expect(() => parseWorkflowImport('{"schemaVersion":"1.0"}')).toThrow(/unsupported or contains invalid graph data/)
  })
})

describe('isCatalystDefinition', () => {
  const valid = {
    id: 'pr-check', name: 'PR check', kind: 'connector-event', selector: 'github.pull_request.opened',
    security: 'connector-oauth', status: 'awaiting-runner', createdAt: '2026-08-04T00:00:00.000Z',
  }

  it('accepts a definition with no workflow attached yet', () => {
    expect(isCatalystDefinition(valid)).toBe(true)
    expect(isCatalystDefinition({ ...valid, workflowId: 'flow', workflowName: 'Flow' })).toBe(true)
  })

  it('accepts string settings only', () => {
    expect(isCatalystDefinition({ ...valid, settings: { connector: 'github' } })).toBe(true)
    expect(isCatalystDefinition({ ...valid, settings: { retries: 3 } })).toBe(false)
  })

  it('rejects an unknown kind, security model, or status', () => {
    expect(isCatalystDefinition({ ...valid, kind: 'telepathy' })).toBe(false)
    expect(isCatalystDefinition({ ...valid, security: 'none' })).toBe(false)
    expect(isCatalystDefinition({ ...valid, status: 'running' })).toBe(false)
  })

  it('rejects an empty id or name', () => {
    expect(isCatalystDefinition({ ...valid, id: '' })).toBe(false)
    expect(isCatalystDefinition({ ...valid, name: '' })).toBe(false)
  })
})

describe('isWorkflowRecord', () => {
  const record = (overrides: Record<string, unknown> = {}) => ({
    id: 'flow', name: 'Flow', description: '', nodeCount: 2, status: 'ready', source: 'local', ...overrides,
  })

  it('accepts a saved record', () => {
    expect(isWorkflowRecord(record())).toBe(true)
    expect(isWorkflowRecord(record({ entryMode: 'catalyst', steps: ['one'] }))).toBe(true)
  })

  it('rejects unknown status, source, and entry mode', () => {
    expect(isWorkflowRecord(record({ status: 'archived' }))).toBe(false)
    expect(isWorkflowRecord(record({ source: 'elsewhere' }))).toBe(false)
    expect(isWorkflowRecord(record({ entryMode: 'cron' }))).toBe(false)
    expect(isWorkflowRecord(record({ steps: ['ok', 3] }))).toBe(false)
  })
})

describe('isWorkflowTemplate', () => {
  const template = (overrides: Record<string, unknown> = {}) => ({
    id: 'release', name: 'Release', description: '', level: 'Guided', steps: [],
    componentIds: [], source: 'user', published: false, ...overrides,
  })

  it('accepts a template', () => {
    expect(isWorkflowTemplate(template())).toBe(true)
  })

  // Why: the storage guard used to skip `level` and `source`, so a template stored without them
  // loaded fine and then crashed the Templates page on `template.level.toLowerCase()`.
  it('rejects a template with no level or an unknown one', () => {
    expect(isWorkflowTemplate(template({ level: undefined }))).toBe(false)
    expect(isWorkflowTemplate(template({ level: 'Expert' }))).toBe(false)
    expect(isWorkflowTemplate(template({ source: undefined }))).toBe(false)
  })
})

describe('isPendingRun', () => {
  const run = (configuration: Record<string, unknown> = {}) => ({
    id: 'run-1', workflowName: 'Flow', createdAt: '2026-08-04T00:00:00.000Z', state: 'staged',
    configuration: { task: 'Ship it', autonomy: 'adaptive', execution: 'execute', ...configuration },
  })

  it('accepts a staged run', () => {
    expect(isPendingRun(run())).toBe(true)
    expect(isPendingRun(run({ specificationMode: 'exact' }))).toBe(true)
  })

  it('rejects unknown autonomy, execution, and specification modes', () => {
    expect(isPendingRun(run({ autonomy: 'full' }))).toBe(false)
    expect(isPendingRun(run({ execution: 'simulate' }))).toBe(false)
    expect(isPendingRun(run({ specificationMode: 'loose' }))).toBe(false)
  })
})

describe('isRunMonitorBoard', () => {
  const board = (overrides: Record<string, unknown> = {}) => ({
    name: 'Codebase runs', columns: 2, groups: [{ id: 'workspace', name: 'Workspace' }],
    tiles: [{ id: 'run-1', groupId: 'workspace', workflowName: 'Flow', status: 'running', steps: [] }],
    ...overrides,
  })

  it('accepts a board whose tiles all point at a real group', () => {
    expect(isRunMonitorBoard(board())).toBe(true)
  })

  it('rejects a tile in a group that does not exist', () => {
    expect(isRunMonitorBoard(board({ tiles: [{ id: 'r', groupId: 'gone', workflowName: 'Flow', status: 'running', steps: [] }] }))).toBe(false)
  })

  it('rejects duplicate groups, no groups, and an unsupported column count', () => {
    expect(isRunMonitorBoard(board({ groups: [] }))).toBe(false)
    expect(isRunMonitorBoard(board({ groups: [{ id: 'a', name: 'A' }, { id: 'a', name: 'A again' }] }))).toBe(false)
    expect(isRunMonitorBoard(board({ columns: 3 }))).toBe(false)
  })
})
