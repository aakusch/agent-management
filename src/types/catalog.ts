import type { RunConfiguration } from '../components/StartRunModal'

export interface WorkflowRecord {
  id: string
  name: string
  description: string
  nodeCount: number
  projectName?: string
  updatedAt?: string
  status: 'draft' | 'ready'
  source: 'starter' | 'local' | 'imported'
  steps?: string[]
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  level: 'Guided' | 'Advanced'
  steps: string[]
  componentIds: string[]
  source: 'built-in' | 'user' | 'community'
  author?: string
  published: boolean
  createdAt?: string
}

export interface PendingRun {
  id: string
  workflowName: string
  projectName?: string
  configuration: RunConfiguration
  createdAt: string
  state: 'waiting-for-runner'
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
  workflowId: string
  workflowName: string
  selector: string
  security: 'hmac' | 'connector-oauth' | 'runner-token'
  status: 'awaiting-runner' | 'paused'
  createdAt: string
}
