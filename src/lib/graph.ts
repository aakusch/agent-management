import { MarkerType } from '@xyflow/react'
import { isRecord } from './storage'
import type { ComponentTemplate, WorkflowEdge, WorkflowEdgeData, WorkflowHandoff, WorkflowNode, WorkflowWhen } from '../types/workflow'

export const DEFAULT_HANDOFF: WorkflowHandoff = 'summary'
const handoffValues = new Set<WorkflowHandoff>(['signal', 'summary', 'full'])

/**
 * Graphs saved before transitions were simplified carry a payload object and a structured handoff
 * object. Collapse both into the single handoff choice so old documents keep working.
 */
export function normalizeEdgeData(data: unknown): WorkflowEdgeData {
  if (!isRecord(data)) return { tone: 'default', when: 'always', handoff: DEFAULT_HANDOFF }
  // Legacy keys (payload, delaySeconds, onBlocked, priority) are intentionally dropped here.
  const { payload, handoff, trigger, condition, when, ...rest } = data as Record<string, unknown>
  delete (rest as Record<string, unknown>).delaySeconds
  delete (rest as Record<string, unknown>).onBlocked
  delete (rest as Record<string, unknown>).priority
  const payloadMode = isRecord(payload) ? String(payload.mode) : undefined
  const resolved: WorkflowHandoff = typeof handoff === 'string' && handoffValues.has(handoff as WorkflowHandoff)
    ? handoff as WorkflowHandoff
    : isRecord(handoff)
      ? 'full'
      : payloadMode === 'none'
        ? 'signal'
        : payloadMode === 'all' || payloadMode === 'selected'
          ? 'full'
          : DEFAULT_HANDOFF
  return {
    ...(rest as WorkflowEdgeData),
    when: resolveWhen(when, trigger, condition),
    handoff: resolved,
  }
}

/**
 * Collapses the old `trigger` + freeform `condition` pair into a single `when`.
 *
 * Why: routing used to be a hand-typed expression (`route == ship`) that nothing validated and
 * that could disagree with the connector's own label. A connector now names one outcome, and the
 * only strings it may name are the ones its source step declares.
 */
export function resolveWhen(when: unknown, trigger?: unknown, condition?: unknown): WorkflowWhen {
  if (typeof when === 'string' && when.trim()) return when.trim()
  if (trigger === 'human') return 'approved'
  if (trigger === 'condition' && typeof condition === 'string') {
    // `route == ship`, `verdict == pass`, or a bare outcome name
    const match = condition.match(/([A-Za-z0-9_-]+)\s*$/)
    if (match) return match[1]
  }
  return 'always'
}

/** Everything a connector leaving this step may be set to, in the order the picker shows them. */
export function whenOptions(source?: WorkflowNode): Array<{ id: string; label: string }> {
  const declared = source?.data.outcomes ?? []
  const options = [{ id: 'always', label: 'Whenever it finishes' }]
  declared.forEach((name) => options.push({ id: name, label: describeWhen(name) }))
  if (source?.data.kind === 'human') options.push({ id: 'approved', label: 'When it is approved' })
  options.push({ id: 'failed', label: 'When it fails' })
  options.push({ id: 'else', label: 'Anything else' })
  return options
}

/** Plain-language label for a `when` value, used in the picker and on the connector. */
export function describeWhen(when: string): string {
  if (when === 'always') return 'Whenever it finishes'
  if (when === 'failed') return 'When it fails'
  if (when === 'approved') return 'When it is approved'
  if (when === 'else') return 'Anything else'
  if (/^pass(ed)?$/i.test(when)) return 'When it passes'
  return `When it says ${when}`
}

/** The connector's canvas label: the outcome's own name, and nothing for the default. */
export function whenLabel(when: string | undefined): string {
  if (!when || when === 'always') return ''
  if (when === 'else') return 'otherwise'
  return when
}

/**
 * The outcome a newly drawn connector should adopt: the first one this step declares that no
 * other connector already routes. Dragging three connectors off a judge therefore lands its
 * three outcomes in order, with nothing to configure.
 */
export function nextUnroutedOutcome(source: WorkflowNode | undefined, edges: WorkflowEdge[]): WorkflowWhen {
  const declared = source?.data.outcomes ?? []
  if (!declared.length) return 'always'
  const taken = new Set(edges.filter((item) => item.source === source?.id).map((item) => item.data?.when))
  return declared.find((name) => !taken.has(name)) ?? 'always'
}

export const normalizeEdges = <T extends { data?: unknown }>(edges: T[]): T[] =>
  edges.map((item) => ({ ...item, data: normalizeEdgeData(item.data) }))

/** Matches the canvas dot background gap so nodes land on visible grid points. */
export const CANVAS_GRID = 24
export const snapGrid: [number, number] = [CANVAS_GRID, CANVAS_GRID]
export const snapToGrid = (position: { x: number; y: number }) => ({
  x: Math.round(position.x / CANVAS_GRID) * CANVAS_GRID,
  y: Math.round(position.y / CANVAS_GRID) * CANVAS_GRID,
})

export function nodeFromTemplate(
  template: ComponentTemplate,
  id: string,
  position: { x: number; y: number },
  description?: string,
): WorkflowNode {
  return {
    id,
    type: 'workflow',
    position: snapToGrid(position),
    data: {
      label: template.name,
      description: description ?? template.description,
      templateId: template.id,
      kind: template.kind,
      icon: template.icon,
      color: template.color,
      status: 'idle',
      instruction: template.instruction,
      outcomes: template.outcomes?.length ? [...template.outcomes] : undefined,
      overrides: {},
      execution: {},
      catalyst: template.kind === 'catalyst' ? {} : undefined,
      subworkflow: template.workflowId ? {
        workflowId: template.workflowId,
        execution: 'isolated',
        onFailure: 'bubble',
      } : undefined,
      module: template.moduleId ? {
        moduleId: template.moduleId,
        version: template.version,
        mode: 'linked',
      } : undefined,
    },
  }
}

/**
 * The graph rules `isWorkflowDocument` refuses to parse.
 *
 * Why this is separate from the authoring check below: saving used to skip validation entirely, so a
 * board with two Catalysts wrote a document the loader then rejected — the workflow vanished on the
 * next boot while its list record stayed behind, opening an empty builder. Anything fatal to the
 * loader has to block the save instead.
 */
export function persistenceProblem(nodes: WorkflowNode[], edges: WorkflowEdge[]): string | null {
  const nodeIds = new Set<string>()
  for (const node of nodes) {
    if (nodeIds.has(node.id)) return `Two components share the id ${node.id}. Delete one and add it again.`
    nodeIds.add(node.id)
  }
  const edgeIds = new Set<string>()
  for (const item of edges) {
    if (edgeIds.has(item.id)) return `Two transitions share the id ${item.id}. Delete one and reconnect.`
    edgeIds.add(item.id)
    if (!nodeIds.has(item.source) || !nodeIds.has(item.target)) return `Transition ${item.id} references a missing component.`
  }
  const catalysts = nodes.filter((node) => node.data.kind === 'catalyst')
  if (catalysts.length > 1) return 'Use one Catalyst start component per workflow.'
  if (catalysts.length === 1 && edges.some((item) => item.target === catalysts[0].id)) {
    return 'The Catalyst must be the starting point and cannot have incoming transitions.'
  }
  return null
}

/** Every authoring rule, including the ones a document can technically be stored without. */
export function graphProblem(nodes: WorkflowNode[], edges: WorkflowEdge[]): string | null {
  const fatal = persistenceProblem(nodes, edges)
  if (fatal) return fatal
  const catalyst = nodes.find((node) => node.data.kind === 'catalyst')
  if (catalyst && !edges.some((item) => item.source === catalyst.id)) return 'Connect the Catalyst to the first executable component.'
  const roots = nodes.filter((node) => !edges.some((item) => item.target === node.id))
  if (catalyst && roots.some((node) => node.id !== catalyst.id)) return 'A catalyst workflow must route every executable component from its Catalyst start.'
  if (!roots.length) return 'The workflow needs a starting component.'
  return routingProblem(nodes, edges)
}

/**
 * The routing rules. These are authoring rules rather than loader-fatal ones: a graph being built
 * will transiently have outcomes that nothing routes yet, and blocking the save would lose work.
 */
export function routingProblem(nodes: WorkflowNode[], edges: WorkflowEdge[]): string | null {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) {
    const outgoing = edges.filter((item) => item.source === node.id)
    if (!outgoing.length) continue
    const elses = outgoing.filter((item) => item.data?.when === 'else')
    if (elses.length > 1) {
      return `${node.data.label} has ${elses.length} "anything else" paths. Only one can be the fallback.`
    }
    const declared = node.data.outcomes ?? []
    const routed = new Set(outgoing.map((item) => item.data?.when).filter((when): when is string => Boolean(when)))
    const routesAnyOutcome = declared.some((name) => routed.has(name))
    if (routesAnyOutcome && !elses.length) {
      const missing = declared.filter((name) => !routed.has(name))
      if (missing.length) {
        return `${node.data.label} can report ${missing.join(', ')}, and nothing routes ${missing.length === 1 ? 'it' : 'them'}. Route ${missing.length === 1 ? 'it' : 'them'} or add an "anything else" path.`
      }
    }
  }
  // A step several paths lead into has to say whether it waits for all of them.
  for (const node of nodes) {
    const incoming = edges.filter((item) => item.target === node.id)
    if (incoming.length > 1 && node.data.waitForAll === undefined) {
      return `${node.data.label} has ${incoming.length} paths leading into it. Choose whether it waits for all of them.`
    }
  }
  void byId
  return null
}

export const edge = (
  id: string,
  source: string,
  target: string,
  options: Partial<WorkflowEdge> = {},
): WorkflowEdge => ({
  id,
  source,
  target,
  type: 'workflow',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  ...options,
})
