import { describe, expect, it } from 'vitest'
import { CANVAS_GRID, DEFAULT_HANDOFF, edge, graphProblem, nodeFromTemplate, normalizeEdgeData, normalizeEdges, persistenceProblem, snapToGrid } from './graph'
import type { ComponentTemplate, WorkflowEdge, WorkflowNode } from '../types/workflow'

const template: ComponentTemplate = {
  id: 'code-review', name: 'Code review', description: 'Reviews a diff.', kind: 'judge',
  icon: 'scan', color: 'violet', version: '1.0.0', tags: [], instruction: 'Read the diff.',
}

describe('snapToGrid', () => {
  it('lands positions on the visible dot grid', () => {
    expect(snapToGrid({ x: 13, y: 37 })).toEqual({ x: CANVAS_GRID, y: 48 })
    expect(snapToGrid({ x: -13, y: 0 })).toEqual({ x: -CANVAS_GRID, y: 0 })
  })
})

describe('nodeFromTemplate', () => {
  it('copies the template and snaps the drop position', () => {
    const node = nodeFromTemplate(template, 'code-review-1', { x: 100, y: 100 })
    expect(node.position).toEqual({ x: 96, y: 96 })
    expect(node.data).toMatchObject({ label: 'Code review', kind: 'judge', status: 'idle', instruction: 'Read the diff.' })
    expect(node.data.subworkflow).toBeUndefined()
    expect(node.data.module).toBeUndefined()
  })

  it('lets a caller override the description for one instance', () => {
    expect(nodeFromTemplate(template, 'a', { x: 0, y: 0 }, 'Only this node').data.description).toBe('Only this node')
  })

  it('carries a nested-workflow or module reference when the template has one', () => {
    expect(nodeFromTemplate({ ...template, workflowId: 'other' }, 'a', { x: 0, y: 0 }).data.subworkflow)
      .toEqual({ workflowId: 'other', execution: 'isolated', onFailure: 'bubble' })
    expect(nodeFromTemplate({ ...template, moduleId: 'checks' }, 'a', { x: 0, y: 0 }).data.module)
      .toEqual({ moduleId: 'checks', version: '1.0.0', mode: 'linked' })
  })
})

describe('normalizeEdgeData', () => {
  it('defaults an edge with no data', () => {
    expect(normalizeEdgeData(undefined)).toEqual({ tone: 'default', trigger: 'always', handoff: DEFAULT_HANDOFF })
  })

  it('keeps a valid handoff choice', () => {
    expect(normalizeEdgeData({ handoff: 'signal' }).handoff).toBe('signal')
  })

  it('collapses the legacy structured handoff object to "full"', () => {
    expect(normalizeEdgeData({ handoff: { fields: ['a'] } }).handoff).toBe('full')
  })

  it('maps the legacy payload mode onto a handoff choice', () => {
    expect(normalizeEdgeData({ payload: { mode: 'none' } }).handoff).toBe('signal')
    expect(normalizeEdgeData({ payload: { mode: 'all' } }).handoff).toBe('full')
    expect(normalizeEdgeData({ payload: { mode: 'selected' } }).handoff).toBe('full')
  })

  it('drops the legacy keys instead of carrying them forward', () => {
    const normalized = normalizeEdgeData({ payload: { mode: 'all' }, delaySeconds: 5, onBlocked: 'wait', priority: 2, label: 'keep' })
    expect(normalized).not.toHaveProperty('payload')
    expect(normalized).not.toHaveProperty('delaySeconds')
    expect(normalized).not.toHaveProperty('onBlocked')
    expect(normalized).not.toHaveProperty('priority')
    expect(normalized.label).toBe('keep')
  })

  it('falls back to "always" for an unrecognized trigger', () => {
    expect(normalizeEdgeData({ trigger: 'whenever' }).trigger).toBe('always')
    expect(normalizeEdgeData({ trigger: 'condition' }).trigger).toBe('condition')
    expect(normalizeEdgeData({ trigger: 'human' }).trigger).toBe('human')
  })

  it('preserves a bounded loop policy', () => {
    const loop = { mode: 'bounded', maxIterations: 3, onExhausted: 'human' }
    expect(normalizeEdgeData({ loop }).loop).toEqual(loop)
  })
})

describe('normalizeEdges', () => {
  it('normalizes every edge and leaves the rest of the shape alone', () => {
    const [normalized] = normalizeEdges([{ id: 'a-b', source: 'a', target: 'b', data: { payload: { mode: 'none' } } }])
    expect(normalized).toMatchObject({ id: 'a-b', source: 'a', target: 'b' })
    expect(normalized.data).toMatchObject({ handoff: 'signal' })
  })
})

describe('edge', () => {
  it('always carries the workflow type and an arrow marker', () => {
    const created = edge('a-b', 'a', 'b')
    expect(created.type).toBe('workflow')
    expect(created.markerEnd).toMatchObject({ width: 16, height: 16 })
  })
})

const graphNode = (id: string, kind: WorkflowNode['data']['kind'] = 'agent'): WorkflowNode =>
  ({ ...nodeFromTemplate({ ...template, kind }, id, { x: 0, y: 0 }) })

const graphEdge = (id: string, source: string, target: string): WorkflowEdge => edge(id, source, target)

describe('persistenceProblem', () => {
  it('accepts a graph the loader can parse back', () => {
    expect(persistenceProblem([graphNode('a'), graphNode('b')], [graphEdge('a-b', 'a', 'b')])).toBeNull()
  })

  // Why: saving used to skip validation, so these graphs were stored and then silently dropped by
  // `isWorkflowDocument` on the next boot — the workflow disappeared while its list record stayed.
  it('rejects a second catalyst', () => {
    const problem = persistenceProblem([graphNode('one', 'catalyst'), graphNode('two', 'catalyst')], [])
    expect(problem).toMatch(/one Catalyst/i)
  })

  it('rejects a transition into the catalyst', () => {
    const nodes = [graphNode('start', 'catalyst'), graphNode('work')]
    const problem = persistenceProblem(nodes, [graphEdge('work-start', 'work', 'start')])
    expect(problem).toMatch(/cannot have incoming/i)
  })

  it('rejects duplicate node and transition ids', () => {
    expect(persistenceProblem([graphNode('a'), graphNode('a')], [])).toMatch(/share the id a/)
    const nodes = [graphNode('a'), graphNode('b')]
    expect(persistenceProblem(nodes, [graphEdge('dupe', 'a', 'b'), graphEdge('dupe', 'b', 'a')])).toMatch(/share the id dupe/)
  })

  it('rejects a transition pointing at a component that is gone', () => {
    expect(persistenceProblem([graphNode('a')], [graphEdge('a-ghost', 'a', 'ghost')])).toMatch(/missing component/)
  })
})

describe('graphProblem', () => {
  it('accepts a connected catalyst graph', () => {
    const nodes = [graphNode('start', 'catalyst'), graphNode('work')]
    expect(graphProblem(nodes, [graphEdge('start-work', 'start', 'work')])).toBeNull()
  })

  it('requires the catalyst to reach the first component', () => {
    expect(graphProblem([graphNode('start', 'catalyst'), graphNode('work')], [])).toMatch(/Connect the Catalyst/)
  })

  it('requires every component to route from the catalyst', () => {
    const nodes = [graphNode('start', 'catalyst'), graphNode('work'), graphNode('orphan')]
    const problem = graphProblem(nodes, [graphEdge('start-work', 'start', 'work')])
    expect(problem).toMatch(/route every executable component/)
  })

  it('requires a starting component when every node has an incoming transition', () => {
    const nodes = [graphNode('a'), graphNode('b')]
    const cycle = [graphEdge('a-b', 'a', 'b'), graphEdge('b-a', 'b', 'a')]
    expect(graphProblem(nodes, cycle)).toMatch(/needs a starting component/)
  })

  it('reports loader-fatal problems first', () => {
    expect(graphProblem([graphNode('x', 'catalyst'), graphNode('y', 'catalyst')], [])).toMatch(/one Catalyst/i)
  })
})
