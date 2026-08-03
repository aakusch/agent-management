import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from '@xyflow/react'
import {
  AlertCircle,
  Box,
  Check,
  ChevronDown,
  Cloud,
  Download,
  FolderGit2,
  Import,
  LayoutTemplate,
  Menu,
  Moon,
  MoreHorizontal,
  Play,
  Settings2,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react'
import { Inspector } from './components/Inspector'
import { Library } from './components/Library'
import { Management, type AppPage } from './components/Management'
import { StartRunModal, type RunConfiguration } from './components/StartRunModal'
import { TransitionInspector } from './components/TransitionInspector'
import { WorkflowEdge } from './components/WorkflowEdge'
import { WorkflowNode } from './components/WorkflowNode'
import { WorkflowToolbar } from './components/WorkflowToolbar'
import { componentById, componentLibrary } from './data/library'
import { builtInTemplates } from './data/templates'
import { isRecord, readStored, removeStored, writeStored } from './lib/storage'
import { isComponentTemplate, isProjectContext, isWorkflowDocument, parseWorkflowImport } from './lib/validation'
import type {
  ComponentTemplate,
  ProjectContext,
  RelayAssignmentBundle,
  WorkflowDocument,
  WorkflowEdge as WorkflowEdgeType,
  WorkflowNode as WorkflowNodeType,
} from './types/workflow'
import type { CatalystDefinition, PendingRun, RunMonitorBoard, WorkflowRecord, WorkflowTemplate } from './types/catalog'

const nodeTypes = { workflow: WorkflowNode }
const edgeTypes = { workflow: WorkflowEdge }
const validPages: AppPage[] = ['dashboard', 'builder', 'workflows', 'components', 'projects', 'templates', 'catalysts', 'runs']

const pageFromHash = () => {
  const candidate = window.location.hash.replace('#/', '') as AppPage
  return validPages.includes(candidate) ? candidate : 'dashboard'
}

const isWorkflowRecordList = (value: unknown): value is WorkflowRecord[] => Array.isArray(value) && value.every((item) =>
  isRecord(item)
  && typeof item.id === 'string'
  && typeof item.name === 'string'
  && typeof item.description === 'string'
  && typeof item.nodeCount === 'number'
  && ['draft', 'ready'].includes(String(item.status))
  && ['starter', 'local', 'imported'].includes(String(item.source))
  && (item.entryMode === undefined || ['manual', 'catalyst'].includes(String(item.entryMode)))
  && (item.steps === undefined || (Array.isArray(item.steps) && item.steps.every((step) => typeof step === 'string'))),
)

const isWorkflowTemplateList = (value: unknown): value is WorkflowTemplate[] => Array.isArray(value) && value.every((item) =>
  isRecord(item)
  && typeof item.id === 'string'
  && typeof item.name === 'string'
  && typeof item.description === 'string'
  && Array.isArray(item.steps)
  && item.steps.every((step) => typeof step === 'string')
  && Array.isArray(item.componentIds)
  && item.componentIds.every((id) => typeof id === 'string')
  && typeof item.published === 'boolean',
)

const isPendingRun = (value: unknown): value is PendingRun => isRecord(value)
  && typeof value.id === 'string'
  && typeof value.workflowName === 'string'
  && typeof value.createdAt === 'string'
  && value.state === 'waiting-for-runner'
  && isRecord(value.configuration)
  && typeof value.configuration.task === 'string'
  && ['guided', 'adaptive', 'autonomous'].includes(String(value.configuration.autonomy))
  && ['execute', 'dry-run'].includes(String(value.configuration.execution))

const isCatalystList = (value: unknown): value is CatalystDefinition[] => Array.isArray(value) && value.every((item) =>
  isRecord(item)
  && typeof item.id === 'string'
  && typeof item.name === 'string'
  && typeof item.workflowId === 'string'
  && ['signed-webhook', 'connector-event', 'cron', 'secure-query'].includes(String(item.kind))
  && ['awaiting-runner', 'paused'].includes(String(item.status)),
)

const isMonitorBoard = (value: unknown): value is RunMonitorBoard => {
  if (!isRecord(value)
    || typeof value.name !== 'string'
    || (value.columns !== 1 && value.columns !== 2)
    || !Array.isArray(value.groups)
    || !value.groups.length
    || !Array.isArray(value.tiles)) return false
  const groupIds = new Set<string>()
  for (const group of value.groups) {
    if (!isRecord(group) || typeof group.id !== 'string' || typeof group.name !== 'string' || groupIds.has(group.id)) return false
    groupIds.add(group.id)
  }
  return value.tiles.every((tile) => isRecord(tile)
    && typeof tile.id === 'string'
    && typeof tile.groupId === 'string'
    && groupIds.has(tile.groupId)
    && typeof tile.workflowName === 'string'
    && ['not-started', 'waiting-runner', 'running', 'blocked', 'completed'].includes(String(tile.status))
    && Array.isArray(tile.steps)
    && tile.steps.every((step) => typeof step === 'string'))
}

const readTheme = (): 'dark' | 'light' => {
  try {
    return window.localStorage.getItem('relay.theme') === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

const projectSeed: ProjectContext = {
  name: 'No project selected',
  root: '',
  branch: '',
  variables: {
    'project.instructions': 'AGENTS.md',
    'commands.check': '',
    'commands.test': '',
    'preview.url': '',
    'visual.tolerance': '',
  },
  defaults: {
    model: 'auto',
    effort: 'medium',
    maxParallelAgents: 3,
    tools: ['filesystem', 'terminal', 'git'],
  },
  permissions: {
    spawnAgents: true,
    shell: 'project',
    network: 'ask',
    publish: 'ask',
  },
}

const normalizeProject = (project: ProjectContext): ProjectContext => ({
  ...project,
  defaults: {
    ...projectSeed.defaults,
    ...(project.defaults ?? {}),
    tools: project.defaults?.tools ?? projectSeed.defaults.tools,
  },
  permissions: { ...projectSeed.permissions, ...(project.permissions ?? {}) },
})

const starterWorkflow: WorkflowRecord = {
  id: 'implementation-quality-loop',
  name: 'Implementation quality loop',
  description: 'Implement, review in parallel, revise when required, and prepare a handoff.',
  nodeCount: 5,
  status: 'ready',
  source: 'starter',
  entryMode: 'manual',
  steps: ['Implement UI', 'Code review', 'Visual judge', 'Quality gate', 'Ship summary'],
}

function nodeFromTemplate(
  template: ComponentTemplate,
  id: string,
  position: { x: number; y: number },
  description?: string,
): WorkflowNodeType {
  return {
    id,
    type: 'workflow',
    position,
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
      subworkflow: template.workflowId ? {
        workflowId: template.workflowId,
        execution: 'isolated',
        context: 'inherit',
        onFailure: 'bubble',
      } : undefined,
    },
  }
}

const initialNodes: WorkflowNodeType[] = [
  nodeFromTemplate(componentById['implement-ui'], 'implement', { x: 40, y: 245 }, 'Implement the run objective using the connected project instructions.'),
  nodeFromTemplate(componentById['code-review'], 'review', { x: 445, y: 72 }, 'Review correctness, maintainability, and project conventions.'),
  nodeFromTemplate(componentById['visual-judge'], 'visual', { x: 445, y: 395 }, 'Evaluate the rendered result against the supplied acceptance criteria.'),
  nodeFromTemplate(componentById['decision-gate'], 'gate', { x: 840, y: 235 }, 'Merge reviewer verdicts and choose the next route.'),
  nodeFromTemplate(componentById.summarize, 'ship', { x: 1225, y: 235 }, 'Prepare a concise, evidence-backed handoff.'),
]

const edge = (
  id: string,
  source: string,
  target: string,
  options: Partial<WorkflowEdgeType> = {},
): WorkflowEdgeType => ({
  id,
  source,
  target,
  type: 'workflow',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  ...options,
})

const initialEdges: WorkflowEdgeType[] = [
  edge('implement-review', 'implement', 'review', { data: { tone: 'success', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' } }),
  edge('implement-visual', 'implement', 'visual', { data: { tone: 'default', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' } }),
  edge('review-gate', 'review', 'gate', { data: { tone: 'success', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' } }),
  edge('visual-gate', 'visual', 'gate', { data: { tone: 'default', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' } }),
  edge('gate-ship', 'gate', 'ship', { data: { label: 'pass', tone: 'success', trigger: 'condition', condition: 'route == ship', payload: { mode: 'summary' }, onBlocked: 'wait' } }),
  edge('gate-loop', 'gate', 'implement', {
    sourceHandle: 'source-bottom',
    targetHandle: 'target-bottom',
    data: {
      label: 'revise',
      tone: 'danger',
      trigger: 'condition',
      condition: 'route == revise',
      payload: { mode: 'all' },
      onBlocked: 'wait',
      loop: { mode: 'bounded', maxIterations: 3, maxDurationMinutes: 30, stopOnNoProgress: 2, onExhausted: 'human' },
    },
  }),
]

const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

interface WorkspaceProps {
  project: ProjectContext
  onUpdateProject: (project: ProjectContext) => void
  components: ComponentTemplate[]
  onImportComponents: (components: ComponentTemplate[]) => void
  onNavigate: (page: AppPage) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onWorkflowSaved: (workflow: WorkflowRecord) => void
  onPrepareRun: (run: PendingRun) => void
  startingTemplate?: WorkflowTemplate
  workflows: WorkflowRecord[]
}

function graphFromTemplate(template: WorkflowTemplate | undefined, components: ComponentTemplate[]) {
  if (!template) return { nodes: initialNodes, edges: initialEdges }
  const lookup = Object.fromEntries(components.map((component) => [component.id, component]))
  const selected = template.componentIds.map((id) => lookup[id]).filter(Boolean)
  if (!selected.length) return { nodes: initialNodes, edges: initialEdges }

  if (template.id === 'ui-quality-loop' && selected.length >= 5) {
    const [implement, review, visual, gate, ship] = selected
    const nodes = [
      nodeFromTemplate(implement, 'implement', { x: 40, y: 245 }),
      nodeFromTemplate(review, 'review', { x: 445, y: 72 }),
      nodeFromTemplate(visual, 'visual', { x: 445, y: 395 }),
      nodeFromTemplate(gate, 'gate', { x: 840, y: 235 }),
      nodeFromTemplate(ship, 'ship', { x: 1225, y: 235 }),
    ]
    const edges = [
      edge('implement-review', 'implement', 'review', { data: { tone: 'success', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' } }),
      edge('implement-visual', 'implement', 'visual', { data: { tone: 'default', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' } }),
      edge('review-gate', 'review', 'gate', { data: { tone: 'success', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' } }),
      edge('visual-gate', 'visual', 'gate', { data: { tone: 'default', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' } }),
      edge('gate-ship', 'gate', 'ship', { data: { label: 'pass', tone: 'success', trigger: 'condition', condition: 'route == ship', payload: { mode: 'summary' }, onBlocked: 'wait' } }),
      edge('gate-loop', 'gate', 'implement', { sourceHandle: 'source-bottom', targetHandle: 'target-bottom', data: { label: 'revise', tone: 'danger', trigger: 'condition', condition: 'route == revise', payload: { mode: 'all' }, onBlocked: 'wait', loop: { mode: 'bounded', maxIterations: 3, maxDurationMinutes: 30, stopOnNoProgress: 2, onExhausted: 'human' } } }),
    ]
    return { nodes, edges }
  }

  const nodes = selected.map((component, index) => nodeFromTemplate(
    component,
    `${component.id}-${index + 1}`,
    { x: 40 + (index % 3) * 390, y: 115 + Math.floor(index / 3) * 330 },
  ))
  const edges = nodes.slice(0, -1).map((node, index) => edge(
    `${node.id}-${nodes[index + 1].id}`,
    node.id,
    nodes[index + 1].id,
    {
      sourceHandle: index === 2 ? 'source-bottom' : undefined,
      targetHandle: index === 2 ? 'target-bottom' : undefined,
      data: { tone: 'default', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' },
    },
  ))
  return { nodes, edges }
}

function Workspace({ project, onUpdateProject, components, onImportComponents, onNavigate, theme, onToggleTheme, onWorkflowSaved, onPrepareRun, startingTemplate, workflows }: WorkspaceProps) {
  const expectedWorkflowId = startingTemplate?.id ?? 'implementation-quality-loop'
  const [startingDocument] = useState<WorkflowDocument | null>(() => readStored<WorkflowDocument | null>(
    'relay.workflow', null, (value): value is WorkflowDocument | null => value === null || isWorkflowDocument(value),
  ))
  const restoredDocument = startingDocument?.id === expectedWorkflowId ? startingDocument : null
  const startingGraph = restoredDocument
    ? { nodes: restoredDocument.nodes, edges: restoredDocument.edges }
    : graphFromTemplate(startingTemplate, components)
  const [nodes, setNodes, onNodesChange] = useNodesState(startingGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(startingGraph.edges)
  const [workflowName, setWorkflowName] = useState(restoredDocument?.name ?? startingTemplate?.name ?? 'Implementation quality loop')
  const [workflowId] = useState(expectedWorkflowId)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [startRunOpen, setStartRunOpen] = useState(false)
  const [kickoffTask, setKickoffTask] = useState('')
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [minimapVisible, setMinimapVisible] = useState(true)
  const importInput = useRef<HTMLInputElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | null>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const workflowComponents = useMemo<ComponentTemplate[]>(() => workflows
    .filter((workflow) => workflow.id !== workflowId)
    .map((workflow) => ({
      id: `workflow-ref-${workflow.id}`,
      name: workflow.name,
      description: `Run the saved ${workflow.name} workflow as a nested, reusable step.`,
      kind: 'workflow',
      icon: 'workflow',
      color: 'cyan',
      version: '1.0.0',
      tags: ['workflow', 'nested', 'reusable'],
      inputs: ['objective', 'context'],
      outputs: ['result', 'artifacts'],
      instruction: `Invoke saved workflow ${workflow.id}. The driver must resolve and validate it before execution.`,
      workflowId: workflow.id,
    })), [workflowId, workflows])
  const authoringComponents = useMemo(() => [...components, ...workflowComponents], [components, workflowComponents])
  const componentLookup = useMemo(() => Object.fromEntries(authoringComponents.map((item) => [item.id, item])), [authoringComponents])
  const catalystNodes = useMemo(() => nodes.filter((node) => node.data.kind === 'catalyst'), [nodes])
  const hasCatalyst = catalystNodes.length > 0
  const isCatalystPrimed = catalystNodes.length === 1
    && edges.some((edge) => edge.source === catalystNodes[0].id)
    && !edges.some((edge) => edge.target === catalystNodes[0].id)
    && nodes.every((node) => node.id === catalystNodes[0].id || edges.some((edge) => edge.target === node.id))

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
  const selectedEdge = useMemo(
    () => edges.find((item) => item.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  )
  const selectedEdgeSource = useMemo(
    () => nodes.find((node) => node.id === selectedEdge?.source),
    [nodes, selectedEdge],
  )
  const selectedEdgeTarget = useMemo(
    () => nodes.find((node) => node.id === selectedEdge?.target),
    [nodes, selectedEdge],
  )

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ message, tone })
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    if (!overflowOpen) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!overflowRef.current?.contains(event.target as Node)) setOverflowOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOverflowOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [overflowOpen])

  const updateNode = useCallback((id: string, patch: Partial<WorkflowNodeType['data']>) => {
    setSaveState('saving')
    setNodes((current) => current.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
    ))
  }, [setNodes])

  const updateEdge = useCallback((id: string, patch: Partial<WorkflowEdgeType['data']>) => {
    setSaveState('saving')
    setEdges((current) => current.map((item) =>
      item.id === id ? { ...item, data: { ...(item.data ?? {}), ...patch } } : item,
    ))
  }, [setEdges])

  const addComponent = useCallback((template: ComponentTemplate, position?: { x: number; y: number }) => {
    const id = `${template.id}-${Date.now()}`
    const fallback = { x: 260 + Math.random() * 420, y: 180 + Math.random() * 260 }
    setNodes((current) => [...current, nodeFromTemplate(template, id, position ?? fallback)])
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
    setSaveState('saving')
  }, [setNodes])

  const onConnect = useCallback((connection: Connection) => {
    if (nodes.some((node) => node.id === connection.target && node.data.kind === 'catalyst')) {
      showToast('A Catalyst is a starting point and cannot receive a transition.', 'error')
      return
    }
    setEdges((current) => addEdge({
      ...connection,
      id: `edge-${Date.now()}`,
      type: 'workflow',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      data: { tone: 'default', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' },
    }, current))
    setSaveState('saving')
  }, [nodes, setEdges, showToast])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const componentId = event.dataTransfer.getData('application/relay-component')
    const template = componentLookup[componentId]
    if (!template) return
    addComponent(template, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }, [addComponent, componentLookup, screenToFlowPosition])

  const documentForExport = useCallback((): WorkflowDocument => ({
    schemaVersion: '1.0',
    id: workflowId,
    name: workflowName,
    description: 'Implement, review in parallel, revise when required, and prepare a handoff.',
    project,
    entry: hasCatalyst ? { mode: 'catalyst', nodeId: catalystNodes[0].id } : { mode: 'manual' },
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  }), [catalystNodes, edges, hasCatalyst, nodes, project, workflowId, workflowName])

  const assignmentForExport = useCallback((): RelayAssignmentBundle => {
    const usedTemplateIds = new Set(nodes.map((node) => node.data.templateId))
    const createdAt = new Date().toISOString()
    return {
      kind: 'relay.assignment',
      schemaVersion: '1.0',
      assignment: {
        id: `assignment-${Date.now()}`,
        title: workflowName,
        task: kickoffTask || 'Complete the supplied task by executing the workflow graph and preserving its decision history.',
        createdAt,
      },
      workflow: documentForExport(),
      components: authoringComponents.filter((component) => usedTemplateIds.has(component.id)),
      driver: {
        protocol: 'relay-driver-v1',
        role: 'Own the workflow state, dispatch configured agents, evaluate deterministic routes, persist every event, and stop only under the declared policy.',
        concurrency: project.defaults.maxParallelAgents,
        stateDirectory: '.relay/runs/{{run.id}}',
        eventLog: '.relay/runs/{{run.id}}/events.jsonl',
        artifactDirectory: '.relay/runs/{{run.id}}/artifacts',
        checkpointAfterEachNode: true,
        defaultModel: project.defaults.model,
        defaultEffort: project.defaults.effort,
        tools: project.defaults.tools,
        stopConditions: {
          maxTotalSteps: 24,
          maxDurationMinutes: 60,
          stopOnNoProgress: 2,
          requireHumanOnExhaustion: true,
        },
        permissions: {
          ...project.permissions,
        },
      },
    }
  }, [authoringComponents, documentForExport, kickoffTask, nodes, project, workflowName])

  const saveWorkflow = useCallback(async () => {
    if (!workflowName.trim()) {
      showToast('Add a workflow name before saving.', 'error')
      return false
    }
    if (!nodes.length) {
      showToast('Add at least one component before saving.', 'error')
      return false
    }
    setSaveState('saving')
    if (!writeStored('relay.workflow', documentForExport())) {
      setSaveState('saved')
      showToast('Could not save in this browser. Check storage permissions.', 'error')
      return false
    }
    onWorkflowSaved({
      id: workflowId,
      name: workflowName,
      description: 'Implement, review in parallel, revise when required, and prepare a handoff.',
      nodeCount: nodes.length,
      projectName: project.root ? project.name : undefined,
      updatedAt: new Date().toISOString(),
      status: 'ready',
      source: 'local',
      entryMode: isCatalystPrimed ? 'catalyst' : 'manual',
      steps: nodes.map((node) => node.data.label),
    })
    await sleep(350)
    setSaveState('saved')
    showToast('Workflow saved locally')
    return true
  }, [documentForExport, isCatalystPrimed, nodes, onWorkflowSaved, project.name, project.root, showToast, workflowId, workflowName])

  const exportWorkflow = useCallback(() => {
    const blob = new Blob([JSON.stringify(assignmentForExport(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.relay.json`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('Driver-ready assignment exported')
  }, [assignmentForExport, showToast, workflowName])

  const openProjectConfig = useCallback(async () => {
    const saved = await saveWorkflow()
    if (saved) onNavigate('projects')
  }, [onNavigate, saveWorkflow])

  const validateWorkflow = useCallback(() => {
    if (!nodes.length) {
      showToast('Add at least one component before validating.', 'error')
      return false
    }
    const nodeIds = new Set(nodes.map((node) => node.id))
    const brokenEdge = edges.find((item) => !nodeIds.has(item.source) || !nodeIds.has(item.target))
    if (brokenEdge) {
      showToast(`Transition ${brokenEdge.id} references a missing component.`, 'error')
      return false
    }
    if (catalystNodes.length > 1) {
      showToast('Use one Catalyst start component per workflow.', 'error')
      return false
    }
    const catalyst = catalystNodes[0]
    if (catalyst && edges.some((edge) => edge.target === catalyst.id)) {
      showToast('The Catalyst must be the starting point and cannot have incoming transitions.', 'error')
      return false
    }
    if (catalyst && !edges.some((edge) => edge.source === catalyst.id)) {
      showToast('Connect the Catalyst to the first executable component.', 'error')
      return false
    }
    const roots = nodes.filter((node) => !edges.some((edge) => edge.target === node.id))
    if (catalyst && roots.some((node) => node.id !== catalyst.id)) {
      showToast('A catalyst workflow must route every executable component from its Catalyst start.', 'error')
      return false
    }
    if (!roots.length) {
      showToast('The workflow needs a starting component.', 'error')
      return false
    }
    showToast(`Workflow valid · ${hasCatalyst ? 'catalyst entry' : 'manual entry'} · ${nodes.length} components · ${edges.length} transitions`)
    return true
  }, [catalystNodes, edges, hasCatalyst, nodes, showToast])

  const primeCatalyst = useCallback(async () => {
    if (!validateWorkflow()) return
    const saved = await saveWorkflow()
    if (saved) onNavigate('catalysts')
  }, [onNavigate, saveWorkflow, validateWorkflow])

  const importWorkflow = useCallback(async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('The file is larger than the 5 MB import limit.')
      const { workflow: imported, components: importedComponents } = parseWorkflowImport(await file.text())
      setNodes(imported.nodes)
      setEdges(imported.edges)
      onUpdateProject(normalizeProject(imported.project))
      if (importedComponents.length) onImportComponents(importedComponents)
      setWorkflowName(imported.name)
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      window.setTimeout(() => fitView({ padding: 0.16, duration: 500 }), 50)
      showToast('Workflow imported')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not import this workflow.', 'error')
    }
  }, [fitView, onImportComponents, onUpdateProject, setEdges, setNodes, showToast])

  const runWorkflow = useCallback(async (configuration: RunConfiguration) => {
    setKickoffTask(configuration.task)
    onPrepareRun({
      id: `run-${Date.now()}`,
      workflowName,
      projectName: project.root ? project.name : undefined,
      configuration,
      createdAt: new Date().toISOString(),
      state: 'waiting-for-runner',
    })
    showToast('Run prepared — connect the Relay CLI to execute')
    await sleep(450)
    onNavigate('runs')
  }, [onNavigate, onPrepareRun, project.name, project.root, showToast, workflowName])

  return (
    <main className="app-shell">
      <header className="topbar" inert={startRunOpen || undefined} aria-hidden={startRunOpen || undefined}>
        <button className="brand brand-button" onClick={() => onNavigate('dashboard')}>
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>Relay</span>
          <em>alpha</em>
        </button>
        <div className="topbar-divider" />
        <button className="workspace-switcher" onClick={() => onNavigate('projects')}>
          <FolderGit2 size={15} />
          {project.name}
          <ChevronDown size={14} />
        </button>
        <div className="topbar-divider" />
        <div className="topbar-workflow-name">
          <span className="workflow-glyph"><GitFlowIcon /></span>
          <div>
            <span className="eyebrow">Workflow</span>
            <input value={workflowName} onChange={(event) => { setWorkflowName(event.target.value); setSaveState('saving') }} aria-label="Workflow name" />
          </div>
        </div>
        <div className="topbar-actions">
          <button className="subtle-button header-action" onClick={() => onNavigate('templates')}><LayoutTemplate size={15} /> Templates</button>
          <button className="subtle-button header-action" onClick={() => void openProjectConfig()}><Settings2 size={15} /> Configure</button>
          {hasCatalyst
            ? <button className="run-button catalyst-prime-button" onClick={() => void primeCatalyst()}><Zap size={14} fill="currentColor" /> Prime catalyst</button>
            : <button className="run-button" onClick={() => setStartRunOpen(true)}><Play size={14} fill="currentColor" /> Run workflow</button>}
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importWorkflow(file)
              event.target.value = ''
            }}
          />
          <button className="save-button" onClick={() => void saveWorkflow()}>
            {saveState === 'saved' ? <Check size={15} /> : <Cloud className="pulse" size={15} />}
            {saveState === 'saved' ? 'Saved' : 'Save'}
          </button>
          <button className="icon-button theme-toggle" onClick={onToggleTheme} aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <div className="overflow-wrap" ref={overflowRef}>
            <button className="icon-button" onClick={() => setOverflowOpen((open) => !open)} aria-label="More workflow actions" aria-expanded={overflowOpen}><MoreHorizontal size={18} /></button>
            {overflowOpen && <div className="overflow-menu" role="menu">
              <button role="menuitem" onClick={() => { importInput.current?.click(); setOverflowOpen(false) }}><Import size={15} /><span><strong>Import workflow</strong><small>Open a JSON or Relay assignment</small></span></button>
              <button role="menuitem" onClick={() => { exportWorkflow(); setOverflowOpen(false) }}><Download size={15} /><span><strong>Export assignment</strong><small>Download the driver-ready bundle</small></span></button>
              <button role="menuitem" onClick={() => { onNavigate('runs'); setOverflowOpen(false) }}><Cloud size={15} /><span><strong>View runs</strong><small>Open live and prepared runs</small></span></button>
            </div>}
          </div>
        </div>
      </header>

      <div className="workspace-body" inert={startRunOpen || undefined} aria-hidden={startRunOpen || undefined}>
        {libraryOpen ? (
          <Library components={authoringComponents} onAdd={addComponent} onCollapse={() => setLibraryOpen(false)} onNewComponent={() => onNavigate('components')} />
        ) : (
          <button className="open-library" onClick={() => setLibraryOpen(true)} aria-label="Open component library">
            <Menu size={17} />
          </button>
        )}

        <section className="canvas-shell">
          <WorkflowToolbar
            minimapVisible={minimapVisible}
            onFitView={() => void fitView({ padding: 0.17, duration: 450 })}
            onValidate={validateWorkflow}
            onToggleMinimap={() => setMinimapVisible((visible) => !visible)}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={(changes) => { onNodesChange(changes); setSaveState('saving') }}
            onEdgesChange={(changes) => { onEdgesChange(changes); setSaveState('saving') }}
            onConnect={onConnect}
            onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); setOverflowOpen(false) }}
            onEdgeClick={(_, selected) => { setSelectedEdgeId(selected.id); setSelectedNodeId(null); setOverflowOpen(false) }}
            onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); setOverflowOpen(false) }}
            onDrop={onDrop}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
            fitView
            fitViewOptions={{ padding: 0.17 }}
            minZoom={0.3}
            maxZoom={1.6}
            defaultEdgeOptions={{ type: 'workflow' }}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color={theme === 'light' ? '#cbd3d8' : '#252a31'} />
            <Controls position="bottom-left" showInteractive={false} />
            {minimapVisible && <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(node) => `var(--${String(node.data?.color ?? 'mint')})`}
              maskColor={theme === 'light' ? 'rgba(236, 240, 242, .78)' : 'rgba(7, 9, 12, .76)'}
            />}
          </ReactFlow>

          <div className="canvas-tip"><Box size={14} /> Drag components onto the canvas · connect handles to define flow</div>
        </section>

        <Inspector
          node={selectedNode}
          project={project}
          sourceInstruction={selectedNode ? componentLookup[selectedNode.data.templateId]?.instruction ?? selectedNode.data.instruction : ''}
          onClose={() => setSelectedNodeId(null)}
          onUpdateNode={updateNode}
          onOpenProjectConfig={() => void openProjectConfig()}
        />
        <TransitionInspector
          edge={selectedEdge}
          sourceNode={selectedEdgeSource}
          targetNode={selectedEdgeTarget}
          sourceOutputs={selectedEdgeSource ? componentLookup[selectedEdgeSource.data.templateId]?.outputs ?? [] : []}
          onClose={() => setSelectedEdgeId(null)}
          onUpdateEdge={updateEdge}
        />
      </div>
      {startRunOpen && <StartRunModal workflowName={workflowName} projectName={project.name} onClose={() => setStartRunOpen(false)} onStart={(configuration) => { setStartRunOpen(false); void runWorkflow(configuration) }} />}
      {toast && <div className={`toast ${toast.tone}`} role="status" aria-live="polite">
        {toast.tone === 'error' ? <AlertCircle size={15} /> : <Check size={15} />} {toast.message}
      </div>}
    </main>
  )
}

function GitFlowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v10a4 4 0 0 0 4 4h8M6 10h7a4 4 0 0 0 4-4V4M4 4h4M16 2v4h4M16 16v4h4" /></svg>
}

export default function App() {
  const [page, setPage] = useState<AppPage>(pageFromHash)
  const [theme, setTheme] = useState<'dark' | 'light'>(readTheme)
  const [project, setProject] = useState<ProjectContext>(() => {
    const parsed = readStored('relay.project', projectSeed, isProjectContext)
    return parsed.name === 'Acme storefront' && parsed.root === './' ? projectSeed : normalizeProject(parsed)
  })
  const [customComponents, setCustomComponents] = useState<ComponentTemplate[]>(() => readStored(
    'relay.components', [], (value): value is ComponentTemplate[] => Array.isArray(value) && value.every(isComponentTemplate),
  ))
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => readStored('relay.workflows', [starterWorkflow], isWorkflowRecordList))
  const [userTemplates, setUserTemplates] = useState<WorkflowTemplate[]>(() => readStored('relay.userTemplates', [], isWorkflowTemplateList))
  const [builderTemplate, setBuilderTemplate] = useState<WorkflowTemplate | undefined>(undefined)
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(() => readStored<PendingRun | null>(
    'relay.pendingRun', null, (value): value is PendingRun | null => value === null || isPendingRun(value),
  ))
  const [catalysts, setCatalysts] = useState<CatalystDefinition[]>(() => readStored('relay.catalysts', [], isCatalystList))
  const [monitorBoard, setMonitorBoard] = useState<RunMonitorBoard>(() => {
    const fallback: RunMonitorBoard = {
      name: 'Codebase runs',
      columns: 2,
      groups: [{ id: 'workspace', name: 'Workspace', projectName: project.root ? project.name : undefined }],
      tiles: [],
    }
    return readStored('relay.monitorBoard', fallback, isMonitorBoard)
  })
  const components = useMemo(() => {
    const customIds = new Set(customComponents.map((item) => item.id))
    return [...componentLibrary.filter((item) => !customIds.has(item.id)), ...customComponents]
  }, [customComponents])

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  useEffect(() => { writeStored('relay.project', project) }, [project])
  useEffect(() => { writeStored('relay.components', customComponents) }, [customComponents])
  useEffect(() => { writeStored('relay.workflows', workflows) }, [workflows])
  useEffect(() => { writeStored('relay.userTemplates', userTemplates) }, [userTemplates])
  useEffect(() => { writeStored('relay.catalysts', catalysts) }, [catalysts])
  useEffect(() => { writeStored('relay.monitorBoard', monitorBoard) }, [monitorBoard])
  useEffect(() => {
    if (pendingRun) writeStored('relay.pendingRun', pendingRun)
    else removeStored('relay.pendingRun')
  }, [pendingRun])
  useEffect(() => {
    if (!pendingRun) return
    setMonitorBoard((current) => {
      if (current.tiles.some((tile) => tile.id === pendingRun.id)) return current
      const workflow = workflows.find((item) => item.name === pendingRun.workflowName)
      const group = current.groups.find((item) => item.projectName === pendingRun.projectName) ?? current.groups[0]
      if (!group) return current
      return {
        ...current,
        tiles: [...current.tiles, {
          id: pendingRun.id,
          groupId: group.id,
          workflowId: workflow?.id,
          workflowName: pendingRun.workflowName,
          objective: pendingRun.configuration.task,
          projectName: pendingRun.projectName,
          status: 'waiting-runner',
          steps: workflow?.steps ?? ['Implement', 'Review', 'Verify', 'Gate', 'Handoff'],
          createdAt: pendingRun.createdAt,
        }],
      }
    })
  }, [pendingRun, workflows])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem('relay.theme', theme) } catch { /* Theme still applies for this session. */ }
  }, [theme])

  const navigate = (nextPage: AppPage) => {
    window.location.hash = `/${nextPage}`
    setPage(nextPage)
  }
  const mergeComponents = (incoming: ComponentTemplate[]) => {
    const builtInIds = new Set(componentLibrary.map((item) => item.id))
    setCustomComponents((current) => {
      const merged = new Map(current.map((item) => [item.id, item]))
      incoming.filter((item) => !builtInIds.has(item.id)).forEach((item) => merged.set(item.id, item))
      return [...merged.values()]
    })
  }

  if (page === 'builder') {
    return (
      <ReactFlowProvider>
        <Workspace
          key={builderTemplate?.id ?? 'default-workflow'}
          project={project}
          onUpdateProject={setProject}
          components={components}
          onImportComponents={mergeComponents}
          onNavigate={navigate}
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          onWorkflowSaved={(workflow) => setWorkflows((current) => [workflow, ...current.filter((item) => item.id !== workflow.id)])}
          onPrepareRun={setPendingRun}
          startingTemplate={builderTemplate}
          workflows={workflows}
        />
      </ReactFlowProvider>
    )
  }

  return (
    <Management
      page={page}
      onNavigate={navigate}
      project={project}
      onUpdateProject={setProject}
      components={components}
      onCreateComponent={(component) => setCustomComponents((current) => [...current.filter((item) => item.id !== component.id), component])}
      theme={theme}
      onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      workflows={workflows}
      templates={[...userTemplates, ...builtInTemplates]}
      onCreateTemplate={(template) => setUserTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)])}
      onToggleTemplatePublished={(id) => setUserTemplates((current) => current.map((template) => template.id === id ? { ...template, published: !template.published } : template))}
      onUseTemplate={(template) => { removeStored('relay.workflow'); setBuilderTemplate(template); navigate('builder') }}
      pendingRun={pendingRun}
      monitorBoard={monitorBoard}
      onUpdateMonitorBoard={setMonitorBoard}
      catalysts={catalysts}
      onCreateCatalyst={(catalyst) => setCatalysts((current) => [catalyst, ...current.filter((item) => item.id !== catalyst.id)])}
      onToggleCatalyst={(id) => setCatalysts((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'paused' ? 'awaiting-runner' : 'paused' } : item))}
    />
  )
}
