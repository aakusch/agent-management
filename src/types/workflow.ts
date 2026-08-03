import type { Edge, Node } from '@xyflow/react'

export type ComponentKind = 'agent' | 'judge' | 'router' | 'human' | 'tool' | 'module' | 'workflow' | 'catalyst'
export type NodeStatus = 'idle' | 'queued' | 'running' | 'passed' | 'failed'
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'
export type RelayTool = 'filesystem' | 'terminal' | 'git' | 'browser' | 'web'

export interface ExecutionDefaults {
  model: string
  effort: ReasoningEffort
  maxParallelAgents: number
  tools: RelayTool[]
}

export interface ProjectPermissions {
  spawnAgents: boolean
  shell: 'project' | 'read-only' | 'none'
  network: 'ask' | 'allow' | 'deny'
  publish: 'ask' | 'allow' | 'deny'
}

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
  workflowId?: string
  moduleId?: string
}

export type ProjectCapability = 'web' | 'service' | 'database' | 'containers' | 'documentation' | 'benchmarks'

export interface ProjectProfile {
  status: 'not-scanned' | 'configured' | 'scan-requested' | 'ready'
  structure: 'unknown' | 'single-package' | 'monorepo' | 'multi-repository'
  packageManager: 'auto' | 'npm' | 'pnpm' | 'yarn' | 'bun' | 'python' | 'mixed'
  capabilities: ProjectCapability[]
  instructions: string[]
  commands: Partial<Record<'dev' | 'test' | 'typecheck' | 'lint' | 'build', string>>
  scannedAt?: string
}

export interface WorkflowModuleNodeSpec {
  id: string
  componentId: string
  position: { x: number; y: number }
  description?: string
}

export interface WorkflowModuleDefinition {
  id: string
  name: string
  description: string
  version: string
  icon: string
  color: string
  tags: string[]
  inputs: string[]
  outputs: string[]
  source: 'built-in' | 'user'
  nodes: WorkflowModuleNodeSpec[]
  edges: Array<{
    id: string
    source: string
    target: string
    data?: WorkflowEdgeData
  }>
  entryNodeIds: string[]
  exitNodeIds: string[]
  createdAt?: string
}

export interface WorkflowAdaptation {
  templateId: string
  templateName: string
  objective: string
  mode: 'guided' | 'exact'
  status: 'profile-applied' | 'runner-discovery-required'
  applied: string[]
  pending: string[]
  createdAt: string
}

export interface WorkflowSpecificationPolicy {
  enabled: boolean
  componentId: 'workflow-specifier'
  mode: 'guided' | 'exact'
  artifact: 'run-spec.json'
  maySelectOptionalModules: boolean
  mayBindProjectCommands: boolean
  mayConfigureNodes: boolean
  mayRemoveRequiredModules: false
  mayWidenPermissions: false
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
  execution?: {
    model?: string
    effort?: ReasoningEffort
    tools?: RelayTool[]
  }
  catalyst?: {
    definitionId?: string
  }
  subworkflow?: {
    workflowId: string
    execution: 'inline' | 'isolated'
    context: 'inherit' | 'mapped' | 'none'
    onFailure: 'bubble' | 'pause' | 'continue'
  }
  module?: {
    moduleId: string
    version: string
    mode: 'linked' | 'detached'
  }
}

export type WorkflowNode = Node<WorkflowNodeData, 'workflow'>

export interface WorkflowEdgeData extends Record<string, unknown> {
  label?: string
  tone?: 'default' | 'success' | 'danger' | 'warning'
  trigger?: 'always' | 'condition' | 'human' | 'delay'
  condition?: string
  payload?: {
    mode: 'all' | 'selected' | 'summary' | 'none'
    include?: string[]
  }
  handoff?: {
    mode: 'concise' | 'structured' | 'custom'
    required: boolean
    include: Array<'artifacts' | 'decisions' | 'verification' | 'risks' | 'open_questions' | 'next_action'>
    instruction?: string
    onMissing: 'block' | 'auto-summary'
  }
  delaySeconds?: number
  onBlocked?: 'wait' | 'skip' | 'fail'
  priority?: number
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
  defaults: ExecutionDefaults
  permissions: ProjectPermissions
  profile?: ProjectProfile
}

export interface WorkflowDocument {
  schemaVersion: '1.0'
  id: string
  name: string
  description: string
  template?: {
    id: string
    name: string
    requiredModuleIds: string[]
    adaptationRules: Array<{
      capability?: ProjectCapability
      structure?: 'monorepo' | 'multi-repository'
      moduleId: string
      action: 'include' | 'optional'
      reason: string
    }>
  }
  project: ProjectContext
  entry?: {
    mode: 'manual' | 'catalyst'
    nodeId?: string
  }
  specification?: WorkflowSpecificationPolicy
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  adaptation?: WorkflowAdaptation
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
  modules?: WorkflowModuleDefinition[]
  driver: {
    protocol: 'relay-driver-v1'
    role: string
    concurrency: number
    stateDirectory: string
    eventLog: string
    artifactDirectory: string
    checkpointAfterEachNode: boolean
    specification: WorkflowSpecificationPolicy
    defaultModel: string
    defaultEffort: ReasoningEffort
    tools: RelayTool[]
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
