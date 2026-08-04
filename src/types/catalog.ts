import type { RunConfiguration } from '../components/StartRunModal'
import type { ComponentTemplate, ProjectCapability, WorkflowAdaptation, WorkflowDocument, WorkflowModuleDefinition } from './workflow'

export interface RunGraphSnapshot {
  nodes: Array<{ id: string; label: string; kind: string; x: number; y: number }>
  edges: Array<{ id: string; source: string; target: string; label?: string; tone?: string }>
}

export interface WorkflowRecord {
  id: string
  name: string
  description: string
  nodeCount: number
  projectName?: string
  updatedAt?: string
  status: 'draft' | 'ready'
  source: 'starter' | 'local' | 'imported'
  entryMode?: 'manual' | 'catalyst'
  steps?: string[]
  adaptation?: WorkflowAdaptation
}

export interface TemplateAdaptationRule {
  capability?: ProjectCapability
  structure?: 'monorepo' | 'multi-repository'
  moduleId: string
  action: 'include' | 'optional'
  reason: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  level: 'Guided' | 'Advanced'
  steps: string[]
  componentIds: string[]
  moduleIds?: string[]
  adaptationRules?: TemplateAdaptationRule[]
  source: 'built-in' | 'user' | 'community'
  author?: string
  published: boolean
  createdAt?: string
  /**
   * Cloned into the workspace when the template is used, so it works on an empty install. The
   * workflow document carries the whole graph — transitions, gates, loops — not just an ordering.
   */
  assets?: {
    components?: ComponentTemplate[]
    modules?: WorkflowModuleDefinition[]
    workflow?: WorkflowDocument
  }
}

export interface PendingRun {
  id: string
  workflowId?: string
  workflowName: string
  projectName?: string
  configuration: RunConfiguration
  createdAt: string
  state: 'staged' | 'waiting-for-runner'
  preparedBy?: 'user' | 'agent' | 'catalyst'
  graph?: RunGraphSnapshot
  specification?: {
    phase: 0
    status: 'pending'
    componentId: 'workflow-specifier'
    artifact: string
  }
}

export type RunMonitorStatus = 'not-started' | 'waiting-runner' | 'running' | 'blocked' | 'completed'

export interface RunMonitorGroup {
  id: string
  name: string
  projectName?: string
}

export interface RunMonitorTile {
  id: string
  groupId: string
  workflowId?: string
  workflowName: string
  objective?: string
  projectName?: string
  status: RunMonitorStatus
  steps: string[]
  catalyst?: string
  parentWorkflow?: string
  createdAt: string
  updatedAt?: string
  observerUrl?: string
  graph?: RunGraphSnapshot
}

export interface RelayRunEvent {
  protocol: 'relay-events-v1'
  seq: number
  time: string
  runId: string
  type: string
  nodeId?: string
  attempt?: number
  agentId?: string
  payload?: {
    status?: string
    summary?: string
    tool?: string
    command?: string
    route?: string
    artifactIds?: string[]
    [key: string]: unknown
  }
}

export interface RunMonitorBoard {
  name: string
  columns: 1 | 2
  groups: RunMonitorGroup[]
  tiles: RunMonitorTile[]
}

export type CatalystKind = 'signed-webhook' | 'connector-event' | 'cron' | 'secure-query'

export interface CatalystDefinition {
  id: string
  name: string
  kind: CatalystKind
  /** Optional: a catalyst is configured on its own and attached to a workflow later. */
  workflowId?: string
  workflowName?: string
  selector: string
  settings?: Record<string, string>
  security: 'hmac' | 'connector-oauth' | 'runner-token'
  status: 'awaiting-runner' | 'paused'
  createdAt: string
}
