import type { ComponentTemplate, ProjectContext, RelayAssignmentBundle, WorkflowDocument, WorkflowModuleDefinition } from '../types/workflow'
import { isRecord, isStringArray } from './storage'

const componentKinds = new Set(['agent', 'judge', 'router', 'human', 'tool', 'module', 'workflow', 'catalyst'])
const templateKinds = new Set(['agent', 'judge', 'router', 'human', 'tool', 'module', 'workflow'])
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
  if (value.profile !== undefined && (!isRecord(value.profile)
    || !['not-scanned', 'configured', 'scan-requested', 'ready'].includes(String(value.profile.status))
    || !['unknown', 'single-package', 'monorepo', 'multi-repository'].includes(String(value.profile.structure))
    || !['auto', 'npm', 'pnpm', 'yarn', 'bun', 'python', 'mixed'].includes(String(value.profile.packageManager))
    || !isStringArray(value.profile.capabilities)
    || !isStringArray(value.profile.instructions)
    || !isRecord(value.profile.commands)
    || !Object.values(value.profile.commands).every((item) => typeof item === 'string'))) return false
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
    && (value.moduleId === undefined || typeof value.moduleId === 'string')
}

export function isWorkflowModuleDefinition(value: unknown): value is WorkflowModuleDefinition {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.description !== 'string'
    || typeof value.version !== 'string'
    || typeof value.icon !== 'string'
    || typeof value.color !== 'string'
    || !isStringArray(value.tags)
    || !isStringArray(value.inputs)
    || !isStringArray(value.outputs)
    || !['built-in', 'user'].includes(String(value.source))
    || !Array.isArray(value.nodes)
    || !Array.isArray(value.edges)
    || !isStringArray(value.entryNodeIds)
    || !isStringArray(value.exitNodeIds)) return false
  const ids = new Set<string>()
  for (const node of value.nodes) {
    if (!isRecord(node) || typeof node.id !== 'string' || ids.has(node.id) || typeof node.componentId !== 'string' || !isFinitePosition(node.position)) return false
    ids.add(node.id)
  }
  return value.edges.every((edge) => isRecord(edge)
    && typeof edge.id === 'string'
    && typeof edge.source === 'string'
    && typeof edge.target === 'string'
    && ids.has(edge.source)
    && ids.has(edge.target))
    && value.entryNodeIds.every((id) => ids.has(id))
    && value.exitNodeIds.every((id) => ids.has(id))
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
  if (value.template !== undefined && (!isRecord(value.template)
    || typeof value.template.id !== 'string'
    || typeof value.template.name !== 'string'
    || !isStringArray(value.template.requiredModuleIds)
    || !Array.isArray(value.template.adaptationRules)
    || !value.template.adaptationRules.every((rule) => isRecord(rule)
      && typeof rule.moduleId === 'string'
      && ['include', 'optional'].includes(String(rule.action))
      && typeof rule.reason === 'string'))) return false
  if (value.specification !== undefined && (!isRecord(value.specification)
    || typeof value.specification.enabled !== 'boolean'
    || value.specification.componentId !== 'workflow-specifier'
    || !['guided', 'exact'].includes(String(value.specification.mode))
    || value.specification.artifact !== 'run-spec.json')) return false

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
    if (node.data.catalyst !== undefined && (!isRecord(node.data.catalyst)
      || (node.data.catalyst.definitionId !== undefined && typeof node.data.catalyst.definitionId !== 'string'))) return false
    if (node.data.module !== undefined && (!isRecord(node.data.module)
      || typeof node.data.module.moduleId !== 'string'
      || typeof node.data.module.version !== 'string'
      || !['linked', 'detached'].includes(String(node.data.module.mode)))) return false
    if (node.data.kind === 'module' && node.data.module === undefined) return false
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
    if (isRecord(edge.data) && edge.data.handoff !== undefined && (!isRecord(edge.data.handoff)
      || !['concise', 'structured', 'custom'].includes(String(edge.data.handoff.mode))
      || typeof edge.data.handoff.required !== 'boolean'
      || !isStringArray(edge.data.handoff.include)
      || !['block', 'auto-summary'].includes(String(edge.data.handoff.onMissing)))) return false
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
  modules: WorkflowModuleDefinition[]
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
    if (bundle.modules !== undefined && (!Array.isArray(bundle.modules) || !bundle.modules.every(isWorkflowModuleDefinition))) {
      throw new Error('The assignment contains invalid reusable modules.')
    }
    return { workflow: bundle.workflow, components: bundle.components, modules: bundle.modules ?? [] }
  }

  if (!isWorkflowDocument(parsed)) {
    throw new Error('This workflow is unsupported or contains invalid graph data.')
  }
  return { workflow: parsed, components: [], modules: [] }
}
