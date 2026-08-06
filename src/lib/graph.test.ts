import { describe, expect, it } from 'vitest'
import { CANVAS_GRID, DEFAULT_HANDOFF, describeWhen, edge, graphProblem, nextUnroutedOutcome, nodeFromTemplate, normalizeEdgeData, normalizeEdges, persistenceProblem, routingProblem, snapToGrid, whenLabel, whenOptions } from './graph'
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
    expect(normalizeEdgeData(undefined)).toEqual({ tone: 'default', when: 'always', handoff: DEFAULT_HANDOFF })
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

  // Routing used to be a hand-typed expression that nothing validated; old graphs collapse into
  // the single `when` name so they keep working.
  it('collapses a legacy condition into the outcome it named', () => {
    expect(normalizeEdgeData({ trigger: 'condition', condition: 'route == ship' }).when).toBe('ship')
    expect(normalizeEdgeData({ trigger: 'condition', condition: 'verdict == pass' }).when).toBe('pass')
    expect(normalizeEdgeData({ trigger: 'condition', condition: 'revise' }).when).toBe('revise')
  })

  it('maps a legacy human trigger to approval and anything else to always', () => {
    expect(normalizeEdgeData({ trigger: 'human' }).when).toBe('approved')
    expect(normalizeEdgeData({ trigger: 'whenever' }).when).toBe('always')
    expect(normalizeEdgeData({ trigger: 'condition' }).when).toBe('always')
  })

  it('keeps an explicit when and drops the legacy pair', () => {
    const data = normalizeEdgeData({ when: 'escalate', trigger: 'condition', condition: 'route == ship' })
    expect(data.when).toBe('escalate')
    expect(data.condition).toBeUndefined()
    expect(data.trigger).toBeUndefined()
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

const judge = (id: string, outcomes?: string[]): WorkflowNode => {
  const n = nodeFromTemplate({ ...template, kind: 'judge', outcomes }, id, { x: 0, y: 0 })
  return n
}

describe('outcomes on a node', () => {
  it('are copied from the component, so a document validates on its own', () => {
    expect(judge('j', ['pass', 'revise']).data.outcomes).toEqual(['pass', 'revise'])
    expect(judge('j').data.outcomes).toBeUndefined()
  })
})

describe('whenOptions', () => {
  it('offers the declared outcomes plus the universal results', () => {
    const ids = whenOptions(judge('j', ['pass', 'revise', 'escalate'])).map((o) => o.id)
    expect(ids).toEqual(['always', 'pass', 'revise', 'escalate', 'failed', 'else'])
  })

  it('offers only the universal results when nothing is declared', () => {
    expect(whenOptions(judge('j')).map((o) => o.id)).toEqual(['always', 'failed', 'else'])
  })

  it('adds approval only for a human step', () => {
    const human = nodeFromTemplate({ ...template, kind: 'human' }, 'h', { x: 0, y: 0 })
    expect(whenOptions(human).map((o) => o.id)).toContain('approved')
    expect(whenOptions(judge('j')).map((o) => o.id)).not.toContain('approved')
  })
})

describe('describeWhen and whenLabel', () => {
  it('reads as plain language in the picker', () => {
    expect(describeWhen('always')).toBe('Whenever it finishes')
    expect(describeWhen('pass')).toBe('When it passes')
    expect(describeWhen('revise')).toBe('When it says revise')
    expect(describeWhen('else')).toBe('Anything else')
  })

  // The default draws no label, so a plain linear graph carries no routing furniture at all.
  it('labels the board with the outcome name and leaves the default bare', () => {
    expect(whenLabel('always')).toBe('')
    expect(whenLabel(undefined)).toBe('')
    expect(whenLabel('revise')).toBe('revise')
    expect(whenLabel('else')).toBe('otherwise')
  })
})

describe('nextUnroutedOutcome', () => {
  // Dragging three connectors off a judge should land its three outcomes with nothing to configure.
  it('walks the declared outcomes in order as connectors are drawn', () => {
    const j = judge('j', ['pass', 'revise', 'escalate'])
    const drawn: WorkflowEdge[] = []
    const picked: string[] = []
    for (let i = 0; i < 3; i++) {
      const when = nextUnroutedOutcome(j, drawn)
      picked.push(when)
      drawn.push({ ...edge(`e${i}`, 'j', `t${i}`), data: { when } })
    }
    expect(picked).toEqual(['pass', 'revise', 'escalate'])
  })

  it('falls back to always once every outcome is routed, or when none are declared', () => {
    const j = judge('j', ['pass'])
    expect(nextUnroutedOutcome(j, [{ ...edge('e', 'j', 't'), data: { when: 'pass' } }])).toBe('always')
    expect(nextUnroutedOutcome(judge('j'), [])).toBe('always')
  })
})

describe('routingProblem', () => {
  const pair = (when: string, id = 'e1', target = 'b') => ({ ...edge(id, 'j', target), data: { when } })

  it('accepts a fully routed judge', () => {
    const nodes = [judge('j', ['pass', 'revise']), graphNode('b'), graphNode('c')]
    expect(routingProblem(nodes, [pair('pass'), pair('revise', 'e2', 'c')])).toBeNull()
  })

  it('rejects a second fallback', () => {
    const nodes = [judge('j', ['pass']), graphNode('b'), graphNode('c')]
    const problem = routingProblem(nodes, [pair('else'), pair('else', 'e2', 'c')])
    expect(problem).toMatch(/Only one can be the fallback/)
  })

  // PRODUCT.md requires a router to define a fallback; nothing enforced it before.
  it('rejects a partly routed judge with no fallback', () => {
    const nodes = [judge('j', ['pass', 'revise', 'escalate']), graphNode('b')]
    expect(routingProblem(nodes, [pair('pass')])).toMatch(/escalate/)
  })

  it('accepts a partly routed judge that has a fallback', () => {
    const nodes = [judge('j', ['pass', 'revise']), graphNode('b'), graphNode('c')]
    expect(routingProblem(nodes, [pair('pass'), pair('else', 'e2', 'c')])).toBeNull()
  })

  it('leaves a step alone until it routes an outcome at all', () => {
    const nodes = [judge('j', ['pass', 'revise']), graphNode('b')]
    expect(routingProblem(nodes, [pair('always')])).toBeNull()
  })

  // ui-quality-loop already had a two-way join with undefined semantics.
  it('requires a step with several incoming paths to say whether it waits', () => {
    const target = graphNode('gate')
    const nodes = [graphNode('a'), graphNode('b'), target]
    const edges = [graphEdge('a-gate', 'a', 'gate'), graphEdge('b-gate', 'b', 'gate')]
    expect(routingProblem(nodes, edges)).toMatch(/waits for all/)
    target.data.waitForAll = true
    expect(routingProblem(nodes, edges)).toBeNull()
  })
})
