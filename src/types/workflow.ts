import type { Edge, Node } from '@xyflow/react'

export type ComponentKind = 'agent' | 'judge' | 'router' | 'human' | 'tool'
export type NodeStatus = 'idle' | 'queued' | 'running' | 'passed' | 'failed'

export interface ComponentTemplate {
  id: string
  name: string
  description: string
  kind: ComponentKind
  icon: string
  color: string
  version: string
  tags: string[]
  inputs: string[]
  outputs: string[]
  instruction: string
  defaults?: Record<string, string>
}

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string
  description: string
  templateId: string
  kind: ComponentKind
  icon: string
  color: string
  status: NodeStatus
  runtime?: string
  tokens?: string
  result?: string
  instruction: string
  overrides: Record<string, string>
}

export type WorkflowNode = Node<WorkflowNodeData, 'workflow'>

export interface WorkflowEdgeData extends Record<string, unknown> {
  label?: string
  tone?: 'default' | 'success' | 'danger' | 'warning'
  condition?: string
  loop?: {
    mode: 'bounded' | 'until-cancelled'
    maxIterations?: number
    maxDurationMinutes?: number
    stopOnNoProgress?: number
    onExhausted: 'fail' | 'pause' | 'human'
  }
}

export type WorkflowEdge = Edge<WorkflowEdgeData>

export interface ProjectContext {
  name: string
  root: string
  branch: string
  variables: Record<string, string>
}

export interface WorkflowDocument {
  schemaVersion: '1.0'
  id: string
  name: string
  description: string
  project: ProjectContext
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  updatedAt: string
}

export interface RelayAssignmentBundle {
  kind: 'relay.assignment'
  schemaVersion: '1.0'
  assignment: {
    id: string
    title: string
    task: string
    createdAt: string
  }
  workflow: WorkflowDocument
  components: ComponentTemplate[]
  driver: {
    protocol: 'relay-driver-v1'
    role: string
    concurrency: number
    stateDirectory: string
    eventLog: string
    artifactDirectory: string
    checkpointAfterEachNode: boolean
    stopConditions: {
      maxTotalSteps: number
      maxDurationMinutes: number
      maxCostUsd?: number
      stopOnNoProgress: number
      requireHumanOnExhaustion: boolean
    }
    permissions: {
      spawnAgents: boolean
      shell: 'project' | 'read-only' | 'none'
      network: 'ask' | 'allow' | 'deny'
      publish: 'ask' | 'allow' | 'deny'
    }
  }
}
