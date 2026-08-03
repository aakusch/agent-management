import type { ComponentTemplate, ProjectContext, RelayAssignmentBundle, WorkflowDocument } from '../types/workflow'
import { isRecord, isStringArray } from './storage'

const componentKinds = new Set(['agent', 'judge', 'router', 'human', 'tool', 'workflow', 'catalyst'])
const templateKinds = new Set(['agent', 'judge', 'router', 'human', 'tool', 'workflow'])
const nodeStatuses = new Set(['idle', 'queued', 'running', 'passed', 'failed'])
const reasoningEfforts = new Set(['low', 'medium', 'high', 'xhigh'])
const relayTools = new Set(['filesystem', 'terminal', 'git', 'browser', 'web'])

const isFinitePosition = (value: unknown) => isRecord(value)
  && typeof value.x === 'number'
  && Number.isFinite(value.x)
  && typeof value.y === 'number'
  && Number.isFinite(value.y)

export function isProjectContext(value: unknown): value is ProjectContext {
  const baseValid = isRecord(value)
    && typeof value.name === 'string'
    && typeof value.root === 'string'
    && typeof value.branch === 'string'
    && isRecord(value.variables)
    && Object.values(value.variables).every((item) => typeof item === 'string')
  if (!baseValid) return false
  if (value.defaults !== undefined && (!isRecord(value.defaults)
    || typeof value.defaults.model !== 'string'
    || typeof value.defaults.effort !== 'string'
    || !reasoningEfforts.has(value.defaults.effort)
    || typeof value.defaults.maxParallelAgents !== 'number'
    || !Array.isArray(value.defaults.tools)
    || !value.defaults.tools.every((tool) => typeof tool === 'string' && relayTools.has(tool)))) return false
  if (value.permissions !== undefined && (!isRecord(value.permissions)
    || typeof value.permissions.spawnAgents !== 'boolean'
    || !['project', 'read-only', 'none'].includes(String(value.permissions.shell))
    || !['ask', 'allow', 'deny'].includes(String(value.permissions.network))
    || !['ask', 'allow', 'deny'].includes(String(value.permissions.publish)))) return false
  return true
}

export function isComponentTemplate(value: unknown): value is ComponentTemplate {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.description === 'string'
    && typeof value.kind === 'string'
    && templateKinds.has(value.kind)
    && typeof value.icon === 'string'
    && typeof value.color === 'string'
    && typeof value.version === 'string'
    && isStringArray(value.tags)
    && isStringArray(value.inputs)
    && isStringArray(value.outputs)
    && typeof value.instruction === 'string'
    && (value.defaults === undefined || (isRecord(value.defaults) && Object.values(value.defaults).every((item) => typeof item === 'string')))
    && (value.workflowId === undefined || typeof value.workflowId === 'string')
}

export function isWorkflowDocument(value: unknown): value is WorkflowDocument {
  if (!isRecord(value)
    || value.schemaVersion !== '1.0'
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.description !== 'string'
    || typeof value.updatedAt !== 'string'
    || !isProjectContext(value.project)
    || !Array.isArray(value.nodes)
    || !Array.isArray(value.edges)
    || value.nodes.length > 500
    || value.edges.length > 2_000) return false

  if (value.entry !== undefined && (!isRecord(value.entry)
    || !['manual', 'catalyst'].includes(String(value.entry.mode))
    || (value.entry.nodeId !== undefined && typeof value.entry.nodeId !== 'string'))) return false

  const nodeIds = new Set<string>()
  const projectTools: Set<string> | null = value.project.defaults ? new Set(value.project.defaults.tools) : null
  for (const node of value.nodes) {
    if (!isRecord(node)
      || typeof node.id !== 'string'
      || !node.id
      || nodeIds.has(node.id)
      || node.type !== 'workflow'
      || !isFinitePosition(node.position)
      || !isRecord(node.data)
      || typeof node.data.label !== 'string'
      || typeof node.data.description !== 'string'
      || typeof node.data.templateId !== 'string'
      || typeof node.data.kind !== 'string'
      || !componentKinds.has(node.data.kind)
      || typeof node.data.icon !== 'string'
      || typeof node.data.color !== 'string'
      || typeof node.data.status !== 'string'
      || !nodeStatuses.has(node.data.status)
      || typeof node.data.instruction !== 'string'
      || !isRecord(node.data.overrides)
      || !Object.values(node.data.overrides).every((item) => typeof item === 'string')) return false
    if (node.data.execution !== undefined && (!isRecord(node.data.execution)
      || (node.data.execution.model !== undefined && typeof node.data.execution.model !== 'string')
      || (node.data.execution.effort !== undefined && (typeof node.data.execution.effort !== 'string' || !reasoningEfforts.has(node.data.execution.effort)))
      || (node.data.execution.tools !== undefined && (!Array.isArray(node.data.execution.tools) || !node.data.execution.tools.every((tool) => typeof tool === 'string' && relayTools.has(tool) && (!projectTools || projectTools.has(tool))))))) return false
    nodeIds.add(node.id)
  }

  const edgeIds = new Set<string>()
  for (const edge of value.edges) {
    if (!isRecord(edge)
      || typeof edge.id !== 'string'
      || !edge.id
      || edgeIds.has(edge.id)
      || typeof edge.source !== 'string'
      || typeof edge.target !== 'string'
      || !nodeIds.has(edge.source)
      || !nodeIds.has(edge.target)
      || (edge.type !== undefined && edge.type !== 'workflow')
      || (edge.data !== undefined && !isRecord(edge.data))) return false
    edgeIds.add(edge.id)
  }

  const catalystNodes = value.nodes.filter((node) => node.data.kind === 'catalyst')
  if (catalystNodes.length > 1) return false
  if (catalystNodes.length === 1) {
    const entryNode = catalystNodes[0]
    if (value.entry?.mode !== 'catalyst'
      || value.entry.nodeId !== entryNode.id
      || value.edges.some((edge) => edge.target === entryNode.id)) return false
  } else if (value.entry?.mode === 'catalyst') return false

  return true
}

export interface ParsedWorkflowImport {
  workflow: WorkflowDocument
  components: ComponentTemplate[]
}

export function parseWorkflowImport(text: string): ParsedWorkflowImport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }

  if (isRecord(parsed) && parsed.kind === 'relay.assignment') {
    const bundle = parsed as unknown as RelayAssignmentBundle
    if (bundle.schemaVersion !== '1.0' || !isWorkflowDocument(bundle.workflow)) {
      throw new Error('This Relay assignment is unsupported or incomplete.')
    }
    if (!Array.isArray(bundle.components) || !bundle.components.every(isComponentTemplate)) {
      throw new Error('The assignment contains invalid components.')
    }
    return { workflow: bundle.workflow, components: bundle.components }
  }

  if (!isWorkflowDocument(parsed)) {
    throw new Error('This workflow is unsupported or contains invalid graph data.')
  }
  return { workflow: parsed, components: [] }
}
