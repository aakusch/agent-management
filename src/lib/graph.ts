import { MarkerType } from '@xyflow/react'
import { isRecord } from './storage'
import type { ComponentTemplate, WorkflowEdge, WorkflowEdgeData, WorkflowHandoff, WorkflowNode } from '../types/workflow'

export const DEFAULT_HANDOFF: WorkflowHandoff = 'summary'
const handoffValues = new Set<WorkflowHandoff>(['signal', 'summary', 'full'])

/**
 * Graphs saved before transitions were simplified carry a payload object and a structured handoff
 * object. Collapse both into the single handoff choice so old documents keep working.
 */
export function normalizeEdgeData(data: unknown): WorkflowEdgeData {
  if (!isRecord(data)) return { tone: 'default', trigger: 'always', handoff: DEFAULT_HANDOFF }
  // Legacy keys (payload, delaySeconds, onBlocked, priority) are intentionally dropped here.
  const { payload, handoff, trigger, ...rest } = data as Record<string, unknown>
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
    trigger: trigger === 'condition' || trigger === 'human' ? trigger : 'always',
    handoff: resolved,
  }
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
