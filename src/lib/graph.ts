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
