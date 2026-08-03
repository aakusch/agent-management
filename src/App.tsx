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
  Layers3,
  Menu,
  Moon,
  MoreHorizontal,
  Play,
  Sparkles,
  Sun,
  X,
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
import { componentById, componentLibrary, platformComponents } from './data/library'
import { builtInModules, moduleComponentTemplates } from './data/modules'
import { builtInTemplates } from './data/templates'
import { isRecord, readStored, removeStored, writeStored } from './lib/storage'
import { isComponentTemplate, isProjectContext, isWorkflowDocument, isWorkflowModuleDefinition, parseWorkflowImport } from './lib/validation'
import type {
  ComponentTemplate,
  ProjectContext,
  RelayAssignmentBundle,
  WorkflowDocument,
  WorkflowEdge as WorkflowEdgeType,
  WorkflowNode as WorkflowNodeType,
  WorkflowModuleDefinition,
} from './types/workflow'
import type { CatalystDefinition, PendingRun, RunGraphSnapshot, RunMonitorBoard, WorkflowRecord, WorkflowTemplate } from './types/catalog'

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
  && (item.moduleIds === undefined || (Array.isArray(item.moduleIds) && item.moduleIds.every((id) => typeof id === 'string')))
  && (item.adaptationRules === undefined || Array.isArray(item.adaptationRules))
  && typeof item.published === 'boolean',
)

const isPendingRun = (value: unknown): value is PendingRun => isRecord(value)
  && typeof value.id === 'string'
  && typeof value.workflowName === 'string'
  && typeof value.createdAt === 'string'
  && ['staged', 'waiting-for-runner'].includes(String(value.state))
  && isRecord(value.configuration)
  && typeof value.configuration.task === 'string'
  && (value.configuration.specificationMode === undefined || ['adaptive', 'exact'].includes(String(value.configuration.specificationMode)))
  && ['guided', 'adaptive', 'autonomous'].includes(String(value.configuration.autonomy))
  && ['execute', 'dry-run'].includes(String(value.configuration.execution))

const isPendingRunList = (value: unknown): value is PendingRun[] => Array.isArray(value) && value.every(isPendingRun)

const isCatalystList = (value: unknown): value is CatalystDefinition[] => Array.isArray(value) && value.every((item) =>
  isRecord(item)
  && typeof item.id === 'string'
  && typeof item.name === 'string'
  && typeof item.workflowId === 'string'
  && ['signed-webhook', 'connector-event', 'cron', 'secure-query'].includes(String(item.kind))
  && (item.settings === undefined || (isRecord(item.settings) && Object.values(item.settings).every((setting) => typeof setting === 'string')))
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
  profile: {
    status: 'not-scanned',
    structure: 'unknown',
    packageManager: 'auto',
    capabilities: [],
    instructions: ['AGENTS.md', 'CLAUDE.md'],
    commands: {},
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
  profile: { ...projectSeed.profile!, ...(project.profile ?? {}), capabilities: project.profile?.capabilities ?? [], instructions: project.profile?.instructions ?? projectSeed.profile!.instructions, commands: project.profile?.commands ?? {} },
})

const starterWorkflow: WorkflowRecord = {
  id: 'feature-delivery',
  name: 'Feature delivery',
  description: 'Ground the request, implement it in a bounded loop, verify it, and prepare an evidence-backed handoff.',
  nodeCount: 4,
  status: 'ready',
  source: 'starter',
  entryMode: 'manual',
  steps: ['Repository intake', 'Implementation cycle', 'Verification suite', 'Release preparation'],
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
      catalyst: template.kind === 'catalyst' ? {} : undefined,
      subworkflow: template.workflowId ? {
        workflowId: template.workflowId,
        execution: 'isolated',
        context: 'inherit',
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

const normalizeWorkflowNodes = (nodes: WorkflowNodeType[]): WorkflowNodeType[] => nodes.map((node) => node.data.kind === 'catalyst'
  ? { ...node, data: { ...node.data, instruction: '', overrides: {}, execution: {} } }
  : node)

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

function snapshotWithSpecification(nodes: WorkflowNodeType[], edges: WorkflowEdgeType[]): RunGraphSnapshot {
  const catalyst = nodes.find((node) => node.data.kind === 'catalyst')
  const executable = nodes.filter((node) => node.data.kind !== 'catalyst')
  const minX = Math.min(...executable.map((node) => node.position.x), 40)
  const centerY = executable.length ? executable.reduce((sum, node) => sum + node.position.y, 0) / executable.length : 200
  const shift = 360
  const graphNodes: RunGraphSnapshot['nodes'] = nodes.map((node) => ({ id: node.id, label: node.data.label, kind: node.data.kind, x: catalyst && node.id === catalyst.id ? node.position.x : node.position.x + shift, y: node.position.y }))
  graphNodes.push({ id: '__specification__', label: 'Specification preflight', kind: 'platform', x: catalyst ? minX + shift - 320 : minX, y: centerY })
  const roots = executable.filter((node) => !edges.some((item) => item.target === node.id))
  const graphEdges = edges.map((item) => catalyst && item.source === catalyst.id ? { id: `${item.id}-specified`, source: '__specification__', target: item.target, label: item.data?.label, tone: item.data?.tone } : { id: item.id, source: item.source, target: item.target, label: item.data?.label, tone: item.data?.tone })
  if (catalyst) graphEdges.unshift({ id: 'catalyst-specification', source: catalyst.id, target: '__specification__', label: 'verified event', tone: 'success' })
  else roots.forEach((root, index) => graphEdges.unshift({ id: `specification-${root.id}-${index}`, source: '__specification__', target: root.id, label: 'run spec', tone: 'success' }))
  return { nodes: graphNodes, edges: graphEdges }
}

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
  modules: WorkflowModuleDefinition[]
  onCreateModule: (module: WorkflowModuleDefinition) => void
  onImportComponents: (components: ComponentTemplate[]) => void
  onImportModules: (modules: WorkflowModuleDefinition[]) => void
  onNavigate: (page: AppPage) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onWorkflowSaved: (workflow: WorkflowRecord) => void
  onPrepareRun: (run: PendingRun) => void
  startingTemplate?: WorkflowTemplate
  workflows: WorkflowRecord[]
  catalysts: CatalystDefinition[]
  onToggleCatalyst: (id: string) => void
}

function graphFromTemplate(template: WorkflowTemplate | undefined, components: ComponentTemplate[], modules: WorkflowModuleDefinition[]) {
  if (!template) return { nodes: initialNodes, edges: initialEdges }
  const lookup = Object.fromEntries(components.map((component) => [component.id, component]))
  const moduleLookup = Object.fromEntries(moduleComponentTemplates(modules).map((component) => [component.moduleId!, component]))
  const selected = template.moduleIds?.length
    ? template.moduleIds.map((id) => moduleLookup[id]).filter(Boolean)
    : template.componentIds.map((id) => lookup[id]).filter(Boolean)
  if (!selected.length) return { nodes: initialNodes, edges: initialEdges }

  const nodes = selected.map((component, index) => nodeFromTemplate(
    component,
    `${component.id}-${index + 1}`,
    { x: 40 + index * 390, y: 235 },
  ))
  const edges = nodes.slice(0, -1).map((node, index) => edge(
    `${node.id}-${nodes[index + 1].id}`,
    node.id,
    nodes[index + 1].id,
    {
      data: {
        tone: 'default',
        trigger: 'always',
        payload: { mode: 'all' },
        onBlocked: 'wait',
        handoff: { mode: 'structured', required: true, include: ['artifacts', 'decisions', 'verification', 'risks', 'open_questions', 'next_action'], onMissing: 'auto-summary' },
      },
    },
  ))
  return { nodes, edges }
}

function Workspace({ project, onUpdateProject, components, modules, onCreateModule, onImportComponents, onImportModules, onNavigate, theme, onToggleTheme, onWorkflowSaved, onPrepareRun, startingTemplate, workflows, catalysts, onToggleCatalyst }: WorkspaceProps) {
  const expectedWorkflowId = startingTemplate?.id ?? 'feature-delivery'
  const [startingDocument] = useState<WorkflowDocument | null>(() => readStored<WorkflowDocument | null>(
    'relay.workflow', null, (value): value is WorkflowDocument | null => value === null || isWorkflowDocument(value),
  ))
  const restoredDocument = startingDocument?.id === expectedWorkflowId ? startingDocument : null
  const startingGraph = restoredDocument
    ? { nodes: normalizeWorkflowNodes(restoredDocument.nodes), edges: restoredDocument.edges }
    : graphFromTemplate(startingTemplate ?? builtInTemplates.find((template) => template.id === 'feature-delivery'), components, modules)
  const [nodes, setNodes, onNodesChange] = useNodesState(startingGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(startingGraph.edges)
  const [workflowName, setWorkflowName] = useState(restoredDocument?.name ?? startingTemplate?.name ?? 'Feature delivery')
  const [workflowId] = useState(expectedWorkflowId)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [startRunOpen, setStartRunOpen] = useState(false)
  const [moduleSaveOpen, setModuleSaveOpen] = useState(false)
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
  const reusableModuleComponents = useMemo(() => moduleComponentTemplates(modules), [modules])
  const moduleLookup = useMemo(() => Object.fromEntries(modules.map((module) => [module.id, module])), [modules])
  const authoringComponents = useMemo(() => [...platformComponents, ...reusableModuleComponents, ...components, ...workflowComponents], [components, reusableModuleComponents, workflowComponents])
  const componentLookup = useMemo(() => Object.fromEntries(authoringComponents.map((item) => [item.id, item])), [authoringComponents])
  const catalystNodes = useMemo(() => nodes.filter((node) => node.data.kind === 'catalyst'), [nodes])
  const hasCatalyst = catalystNodes.length > 0
  const isCatalystEntrypointValid = catalystNodes.length === 1
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

  const saveAsModule = useCallback((draft: { name: string; description: string; inputs: string[]; outputs: string[] }) => {
    const reusableNodes = nodes.filter((node) => node.data.kind !== 'catalyst')
    if (!reusableNodes.length) {
      showToast('Add at least one reusable component before saving a module.', 'error')
      return
    }
    const reusableIds = new Set(reusableNodes.map((node) => node.id))
    const reusableEdges = edges.filter((item) => reusableIds.has(item.source) && reusableIds.has(item.target))
    const minX = Math.min(...reusableNodes.map((node) => node.position.x))
    const minY = Math.min(...reusableNodes.map((node) => node.position.y))
    const slug = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const definition: WorkflowModuleDefinition = {
      id: slug,
      name: draft.name.trim(),
      description: draft.description.trim() || 'Reusable workflow module.',
      version: '0.1.0', icon: 'workflow', color: 'cyan', tags: ['custom', 'module'],
      inputs: draft.inputs, outputs: draft.outputs, source: 'user', createdAt: new Date().toISOString(),
      nodes: reusableNodes.map((node) => ({ id: node.id, componentId: node.data.templateId, position: { x: node.position.x - minX, y: node.position.y - minY }, description: node.data.description })),
      edges: reusableEdges.map((item) => ({ id: item.id, source: item.source, target: item.target, data: item.data })),
      entryNodeIds: reusableNodes.filter((node) => !reusableEdges.some((item) => item.target === node.id)).map((node) => node.id),
      exitNodeIds: reusableNodes.filter((node) => !reusableEdges.some((item) => item.source === node.id)).map((node) => node.id),
    }
    onCreateModule(definition)
    setModuleSaveOpen(false)
    showToast(`Saved ${definition.name} as a reusable module`)
  }, [edges, nodes, onCreateModule, showToast])

  const expandModule = useCallback((nodeId: string) => {
    const container = nodes.find((node) => node.id === nodeId)
    const definition = container?.data.module ? moduleLookup[container.data.module.moduleId] : undefined
    if (!container || !definition) return
    const stamp = Date.now()
    const ids = Object.fromEntries(definition.nodes.map((item) => [item.id, `${nodeId}-${item.id}-${stamp}`]))
    const expanded = definition.nodes.reduce<WorkflowNodeType[]>((result, item) => {
      const template = componentLookup[item.componentId]
      if (!template) return result
      const child = nodeFromTemplate(template, ids[item.id], { x: container.position.x + item.position.x, y: container.position.y + item.position.y }, item.description)
      result.push({ ...child, data: { ...child.data, module: child.data.module ? { ...child.data.module, mode: 'detached' } : undefined } })
      return result
    }, [])
    if (!expanded.length) {
      showToast('This module references components that are not available in the workspace.', 'error')
      return
    }
    const internalEdges = definition.edges.map((item) => edge(`${nodeId}-${item.id}-${stamp}`, ids[item.source], ids[item.target], { data: item.data }))
    const incoming = edges.filter((item) => item.target === nodeId).flatMap((item) => definition.entryNodeIds.map((entryId, index) => ({ ...item, id: `${item.id}-expanded-${index}-${stamp}`, target: ids[entryId] })))
    const outgoing = edges.filter((item) => item.source === nodeId).flatMap((item) => definition.exitNodeIds.map((exitId, index) => ({ ...item, id: `${item.id}-expanded-${index}-${stamp}`, source: ids[exitId] })))
    setNodes((current) => [...current.filter((node) => node.id !== nodeId), ...expanded])
    setEdges((current) => [...current.filter((item) => item.source !== nodeId && item.target !== nodeId), ...internalEdges, ...incoming, ...outgoing])
    setSelectedNodeId(null)
    setSaveState('saving')
    window.setTimeout(() => fitView({ padding: 0.15, duration: 450 }), 30)
    showToast(`${definition.name} expanded into editable components`)
  }, [componentLookup, edges, fitView, moduleLookup, nodes, setEdges, setNodes, showToast])

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
    description: startingTemplate?.description ?? 'A reusable agent workflow compiled into a project-specific run specification at execution time.',
    template: startingTemplate ? {
      id: startingTemplate.id,
      name: startingTemplate.name,
      requiredModuleIds: startingTemplate.moduleIds ?? [],
      adaptationRules: startingTemplate.adaptationRules ?? [],
    } : restoredDocument?.template,
    project,
    entry: hasCatalyst ? { mode: 'catalyst', nodeId: catalystNodes[0].id } : { mode: 'manual' },
    specification: {
      enabled: true,
      componentId: 'workflow-specifier',
      mode: 'guided',
      artifact: 'run-spec.json',
      maySelectOptionalModules: true,
      mayBindProjectCommands: true,
      mayConfigureNodes: true,
      mayRemoveRequiredModules: false,
      mayWidenPermissions: false,
    },
    nodes: normalizeWorkflowNodes(nodes),
    edges,
    updatedAt: new Date().toISOString(),
  }), [catalystNodes, edges, hasCatalyst, nodes, project, restoredDocument?.template, startingTemplate, workflowId, workflowName])

  const assignmentForExport = useCallback((): RelayAssignmentBundle => {
    const workflowDocument = documentForExport()
    const usedTemplateIds = new Set(nodes.map((node) => node.data.templateId))
    const usedModuleIds = new Set(nodes.map((node) => node.data.module?.moduleId).filter((id): id is string => Boolean(id)))
    workflowDocument.template?.adaptationRules.forEach((rule) => usedModuleIds.add(rule.moduleId))
    let discoveredNestedModule = true
    while (discoveredNestedModule) {
      discoveredNestedModule = false
      modules.filter((module) => usedModuleIds.has(module.id)).forEach((module) => module.nodes.forEach((node) => {
        if (!node.componentId.startsWith('module-')) return
        const nestedId = node.componentId.slice('module-'.length)
        if (!usedModuleIds.has(nestedId)) { usedModuleIds.add(nestedId); discoveredNestedModule = true }
      }))
    }
    const usedModules = modules.filter((module) => usedModuleIds.has(module.id))
    const internalTemplateIds = new Set(usedModules.flatMap((module) => module.nodes.map((node) => node.componentId)))
    internalTemplateIds.add('workflow-specifier')
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
      workflow: workflowDocument,
      components: authoringComponents.filter((component) => component.kind !== 'catalyst' && component.kind !== 'module' && (usedTemplateIds.has(component.id) || internalTemplateIds.has(component.id))),
      modules: usedModules,
      driver: {
        protocol: 'relay-driver-v1',
        role: 'Own the workflow state, dispatch configured agents, evaluate deterministic routes, persist every event, and stop only under the declared policy.',
        concurrency: project.defaults.maxParallelAgents,
        stateDirectory: '.relay/runs/{{run.id}}',
        eventLog: '.relay/runs/{{run.id}}/events.jsonl',
        artifactDirectory: '.relay/runs/{{run.id}}/artifacts',
        checkpointAfterEachNode: true,
        specification: {
          enabled: true,
          componentId: 'workflow-specifier',
          mode: 'guided',
          artifact: 'run-spec.json',
          maySelectOptionalModules: true,
          mayBindProjectCommands: true,
          mayConfigureNodes: true,
          mayRemoveRequiredModules: false,
          mayWidenPermissions: false,
        },
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
  }, [authoringComponents, documentForExport, kickoffTask, modules, nodes, project, workflowName])

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
      description: startingTemplate?.description ?? 'Reusable workflow with a run-specific specification preflight.',
      nodeCount: nodes.length,
      projectName: project.root ? project.name : undefined,
      updatedAt: new Date().toISOString(),
      status: 'ready',
      source: 'local',
      entryMode: isCatalystEntrypointValid ? 'catalyst' : 'manual',
      steps: nodes.map((node) => node.data.label),
    })
    await sleep(350)
    setSaveState('saved')
    showToast('Workflow saved locally')
    return true
  }, [documentForExport, isCatalystEntrypointValid, nodes, onWorkflowSaved, project.name, project.root, showToast, startingTemplate?.description, workflowId, workflowName])

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

  const stageCatalystWorkflow = useCallback(async () => {
    if (!validateWorkflow()) return
    const saved = await saveWorkflow()
    if (!saved) return
    const runId = `run-${Date.now()}`
    onPrepareRun({
      id: runId,
      workflowId,
      workflowName,
      projectName: project.root ? project.name : undefined,
      configuration: {
        task: 'Objective and context will be supplied by the verified catalyst event.',
        specificationMode: 'adaptive',
        autonomy: 'adaptive',
        allowAdjacentFixes: true,
        retryFailures: true,
        execution: 'execute',
      },
      createdAt: new Date().toISOString(),
      state: 'staged',
      preparedBy: 'catalyst',
      specification: { phase: 0, status: 'pending', componentId: 'workflow-specifier', artifact: `.relay/runs/${runId}/run-spec.json` },
      graph: snapshotWithSpecification(nodes, edges),
    })
    onNavigate('runs')
  }, [edges, nodes, onNavigate, onPrepareRun, project.name, project.root, saveWorkflow, validateWorkflow, workflowId, workflowName])

  const importWorkflow = useCallback(async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('The file is larger than the 5 MB import limit.')
      const { workflow: imported, components: importedComponents, modules: importedModules } = parseWorkflowImport(await file.text())
      setNodes(normalizeWorkflowNodes(imported.nodes))
      setEdges(imported.edges)
      onUpdateProject(normalizeProject(imported.project))
      if (importedComponents.length) onImportComponents(importedComponents)
      if (importedModules.length) onImportModules(importedModules)
      setWorkflowName(imported.name)
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      window.setTimeout(() => fitView({ padding: 0.16, duration: 500 }), 50)
      showToast('Workflow imported')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not import this workflow.', 'error')
    }
  }, [fitView, onImportComponents, onImportModules, onUpdateProject, setEdges, setNodes, showToast])

  const runWorkflow = useCallback(async (configuration: RunConfiguration) => {
    setKickoffTask(configuration.task)
    const runId = `run-${Date.now()}`
    onPrepareRun({
      id: runId,
      workflowId,
      workflowName,
      projectName: project.root ? project.name : undefined,
      configuration,
      createdAt: new Date().toISOString(),
      state: 'staged',
      preparedBy: 'user',
      specification: { phase: 0, status: 'pending', componentId: 'workflow-specifier', artifact: `.relay/runs/${runId}/run-spec.json` },
      graph: snapshotWithSpecification(nodes, edges),
    })
    showToast('Workflow staged — start it from Runs when ready')
    await sleep(450)
    onNavigate('runs')
  }, [edges, nodes, onNavigate, onPrepareRun, project.name, project.root, showToast, workflowId, workflowName])

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
          {hasCatalyst
            ? <button className="run-button" onClick={() => void stageCatalystWorkflow()}><Zap size={14} fill="currentColor" /> Stage</button>
            : <button className="run-button" onClick={() => setStartRunOpen(true)}><Play size={14} fill="currentColor" /> Stage workflow</button>}
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
          <div className="overflow-wrap" ref={overflowRef}>
            <button className="icon-button" onClick={() => setOverflowOpen((open) => !open)} aria-label="More workflow actions" aria-expanded={overflowOpen}><MoreHorizontal size={18} /></button>
            {overflowOpen && <div className="overflow-menu" role="menu">
              <button role="menuitem" onClick={() => { importInput.current?.click(); setOverflowOpen(false) }}><Import size={15} /><span><strong>Import workflow</strong><small>Open a JSON or Relay assignment</small></span></button>
              <button role="menuitem" onClick={() => { exportWorkflow(); setOverflowOpen(false) }}><Download size={15} /><span><strong>Export assignment</strong><small>Download the driver-ready bundle</small></span></button>
              <button role="menuitem" onClick={() => { setModuleSaveOpen(true); setOverflowOpen(false) }}><Layers3 size={15} /><span><strong>Save as reusable module</strong><small>Reuse this graph inside other workflows</small></span></button>
              <button role="menuitem" onClick={() => { onNavigate('runs'); setOverflowOpen(false) }}><Cloud size={15} /><span><strong>View runs</strong><small>Open live and prepared runs</small></span></button>
              <button role="menuitem" onClick={() => { onToggleTheme(); setOverflowOpen(false) }}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}<span><strong>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</strong><small>Change the interface appearance</small></span></button>
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
          <div className="specification-strip"><span><Sparkles size={14} /></span><div><strong>Specification preflight</strong><small>At run start, Relay writes <code>run-spec.json</code> for this objective and project before entering the graph.</small></div><em>{startingTemplate?.adaptationRules?.length ?? 0} adaptive rules</em></div>
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
          catalysts={catalysts}
          workflowId={workflowId}
          onClose={() => setSelectedNodeId(null)}
          onUpdateNode={updateNode}
          onOpenProjectConfig={() => void openProjectConfig()}
          onOpenCatalysts={() => void stageCatalystWorkflow()}
          onToggleCatalyst={onToggleCatalyst}
          modules={modules}
          onExpandModule={expandModule}
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
      {moduleSaveOpen && <SaveModuleModal workflowName={workflowName} onClose={() => setModuleSaveOpen(false)} onSave={saveAsModule} />}
      {toast && <div className={`toast ${toast.tone}`} role="status" aria-live="polite">
        {toast.tone === 'error' ? <AlertCircle size={15} /> : <Check size={15} />} {toast.message}
      </div>}
    </main>
  )
}

function SaveModuleModal({ workflowName, onClose, onSave }: { workflowName: string; onClose: () => void; onSave: (draft: { name: string; description: string; inputs: string[]; outputs: string[] }) => void }) {
  const [name, setName] = useState(`${workflowName} module`)
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState('objective, project_context')
  const [outputs, setOutputs] = useState('result, artifacts')
  const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="save-module-modal" role="dialog" aria-modal="true" aria-labelledby="save-module-title" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSave({ name: name.trim(), description: description.trim(), inputs: split(inputs), outputs: split(outputs) }) }}>
      <header className="modal-heading"><div><span className="eyebrow">Reusable composition</span><h2 id="save-module-title">Save workflow as a module</h2><p>The current graph, internal routes, loops, and handoffs become one linked node.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close module dialog"><X size={17} /></button></header>
      <div className="editor-form module-save-fields">
        <label><span>Module name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the reusable job this module completes." /></label>
        <div className="two-column"><label><span>Public inputs</span><input value={inputs} onChange={(event) => setInputs(event.target.value)} /></label><label><span>Public outputs</span><input value={outputs} onChange={(event) => setOutputs(event.target.value)} /></label></div>
      </div>
      <footer className="modal-footer"><div><Layers3 size={15} /><small>Project paths and temporary objectives remain outside the module.</small></div><button type="button" className="secondary-cta" onClick={onClose}>Cancel</button><button className="primary-cta" type="submit" disabled={!name.trim()}>Save module</button></footer>
    </form>
  </div>
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
  const [customModules, setCustomModules] = useState<WorkflowModuleDefinition[]>(() => readStored(
    'relay.modules', [], (value): value is WorkflowModuleDefinition[] => Array.isArray(value) && value.every(isWorkflowModuleDefinition),
  ))
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => {
    const saved = readStored('relay.workflows', [starterWorkflow], isWorkflowRecordList)
    const onlyLegacyStarter = saved.length === 1
      && saved[0].id === 'implementation-quality-loop'
      && saved[0].source === 'starter'
    return onlyLegacyStarter ? [starterWorkflow] : saved
  })
  const [userTemplates, setUserTemplates] = useState<WorkflowTemplate[]>(() => readStored('relay.userTemplates', [], isWorkflowTemplateList))
  const [builderTemplate, setBuilderTemplate] = useState<WorkflowTemplate | undefined>(undefined)
  const [stagedRuns, setStagedRuns] = useState<PendingRun[]>(() => {
    const saved = readStored('relay.stagedRuns', [], isPendingRunList)
    if (saved.length) return saved
    const legacy = readStored<PendingRun | null>('relay.pendingRun', null, (value): value is PendingRun | null => value === null || isPendingRun(value))
    return legacy ? [{ ...legacy, state: 'staged' }] : []
  })
  const [catalysts, setCatalysts] = useState<CatalystDefinition[]>(() => readStored('relay.catalysts', [], isCatalystList))
  const [monitorBoard, setMonitorBoard] = useState<RunMonitorBoard>(() => {
    const fallback: RunMonitorBoard = {
      name: 'Codebase runs',
      columns: 2,
      groups: [{ id: 'workspace', name: 'Workspace', projectName: project.root ? project.name : undefined }],
      tiles: [],
    }
    const saved = readStored('relay.monitorBoard', fallback, isMonitorBoard)
    return { ...saved, tiles: saved.tiles.filter((tile) => tile.status !== 'not-started') }
  })
  const components = useMemo(() => {
    const customIds = new Set(customComponents.map((item) => item.id))
    return [...componentLibrary.filter((item) => !customIds.has(item.id)), ...customComponents]
  }, [customComponents])
  const modules = useMemo(() => {
    const customIds = new Set(customModules.map((item) => item.id))
    return [...builtInModules.filter((item) => !customIds.has(item.id)), ...customModules]
  }, [customModules])

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  useEffect(() => { writeStored('relay.project', project) }, [project])
  useEffect(() => { writeStored('relay.components', customComponents) }, [customComponents])
  useEffect(() => { writeStored('relay.modules', customModules) }, [customModules])
  useEffect(() => { writeStored('relay.workflows', workflows) }, [workflows])
  useEffect(() => { writeStored('relay.userTemplates', userTemplates) }, [userTemplates])
  useEffect(() => { writeStored('relay.catalysts', catalysts) }, [catalysts])
  useEffect(() => { writeStored('relay.monitorBoard', monitorBoard) }, [monitorBoard])
  useEffect(() => { writeStored('relay.stagedRuns', stagedRuns) }, [stagedRuns])
  useEffect(() => { removeStored('relay.pendingRun') }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem('relay.theme', theme) } catch { /* Theme still applies for this session. */ }
  }, [theme])

  const navigate = (nextPage: AppPage) => {
    const destination = nextPage === 'catalysts' ? 'components' : nextPage
    window.location.hash = `/${destination}`
    setPage(destination)
  }
  const mergeComponents = (incoming: ComponentTemplate[]) => {
    const builtInIds = new Set(componentLibrary.map((item) => item.id))
    setCustomComponents((current) => {
      const merged = new Map(current.map((item) => [item.id, item]))
      incoming.filter((item) => !builtInIds.has(item.id)).forEach((item) => merged.set(item.id, item))
      return [...merged.values()]
    })
  }
  const mergeModules = (incoming: WorkflowModuleDefinition[]) => {
    const builtInIds = new Set(builtInModules.map((item) => item.id))
    setCustomModules((current) => {
      const merged = new Map(current.map((item) => [item.id, item]))
      incoming.filter((item) => !builtInIds.has(item.id)).forEach((item) => merged.set(item.id, { ...item, source: 'user' }))
      return [...merged.values()]
    })
  }

  const stageSavedWorkflow = (workflow: WorkflowRecord, configuration: RunConfiguration) => {
    const savedDocument = readStored<WorkflowDocument | null>(
      'relay.workflow', null, (value): value is WorkflowDocument | null => value === null || isWorkflowDocument(value),
    )
    const graph = savedDocument?.id === workflow.id ? snapshotWithSpecification(savedDocument.nodes, savedDocument.edges) : undefined
    const runId = `run-${Date.now()}`
    const run: PendingRun = {
      id: runId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      projectName: workflow.projectName ?? (project.root ? project.name : undefined),
      configuration,
      createdAt: new Date().toISOString(),
      state: 'staged',
      preparedBy: 'user',
      specification: { phase: 0, status: 'pending', componentId: 'workflow-specifier', artifact: `.relay/runs/${runId}/run-spec.json` },
      graph,
    }
    setStagedRuns((current) => [run, ...current.filter((item) => item.id !== run.id)])
    navigate('runs')
  }

  if (page === 'builder') {
    return (
      <ReactFlowProvider>
        <Workspace
          key={builderTemplate?.id ?? 'default-workflow'}
          project={project}
          onUpdateProject={setProject}
          components={components}
          modules={modules}
          onCreateModule={(module) => setCustomModules((current) => [module, ...current.filter((item) => item.id !== module.id)])}
          onImportComponents={mergeComponents}
          onImportModules={mergeModules}
          onNavigate={navigate}
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          onWorkflowSaved={(workflow) => setWorkflows((current) => [workflow, ...current.filter((item) => item.id !== workflow.id)])}
          onPrepareRun={(run) => setStagedRuns((current) => [run, ...current.filter((item) => item.id !== run.id)])}
          startingTemplate={builderTemplate}
          workflows={workflows}
          catalysts={catalysts}
          onToggleCatalyst={(id) => setCatalysts((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'paused' ? 'awaiting-runner' : 'paused' } : item))}
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
      modules={modules}
      onCreateComponent={(component) => setCustomComponents((current) => [...current.filter((item) => item.id !== component.id), component])}
      onCreateModule={(module) => setCustomModules((current) => [module, ...current.filter((item) => item.id !== module.id)])}
      theme={theme}
      onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      workflows={workflows}
      templates={[...userTemplates, ...builtInTemplates]}
      onCreateTemplate={(template) => setUserTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)])}
      onToggleTemplatePublished={(id) => setUserTemplates((current) => current.map((template) => template.id === id ? { ...template, published: !template.published } : template))}
      onUseTemplate={(template) => { removeStored('relay.workflow'); setBuilderTemplate(template); navigate('builder') }}
      onStageWorkflow={stageSavedWorkflow}
      stagedRuns={stagedRuns}
      onUpdateStagedRuns={setStagedRuns}
      monitorBoard={monitorBoard}
      onUpdateMonitorBoard={setMonitorBoard}
      catalysts={catalysts}
      onCreateCatalyst={(catalyst) => setCatalysts((current) => [catalyst, ...current.filter((item) => item.id !== catalyst.id)])}
      onToggleCatalyst={(id) => setCatalysts((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'paused' ? 'awaiting-runner' : 'paused' } : item))}
    />
  )
}
