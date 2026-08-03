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
