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
import { ModuleComposer } from './components/ModuleComposer'
import { StartRunModal, type RunConfiguration } from './components/StartRunModal'
import { TransitionInspector } from './components/TransitionInspector'
import { WorkflowEdge } from './components/WorkflowEdge'
import { WorkflowNode } from './components/WorkflowNode'
import { WorkflowToolbar } from './components/WorkflowToolbar'
import { componentLibrary, platformComponents } from './data/library'
import { builtInModules, moduleComponentTemplates } from './data/modules'
import { builtInTemplates } from './data/templates'
import { markForReview, type ParsedAssets } from './lib/assets'
import { DEFAULT_HANDOFF, edge, nodeFromTemplate, normalizeEdgeData, normalizeEdges, snapGrid } from './lib/graph'
import { instanceId, slugify, uniqueId } from './lib/ids'
import { isRecord, readStored, readStoredItems, removeStored, writeStored } from './lib/storage'
import { onWorkspaceFilesChanged, readWorkspaceFiles, serializeCatalyst, serializeComponent, serializeDocument, serializeModule, serializeTemplate, syncCollection, type WorkspaceFiles } from './lib/workspaceFiles'
import { isCatalystDefinition, isComponentTemplate, isProjectContext, isWorkflowDocument, isWorkflowModuleDefinition, parseWorkflowImport } from './lib/validation'
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
const validPages: AppPage[] = ['dashboard', 'builder', 'module-builder', 'workflows', 'components', 'projects', 'templates', 'catalysts', 'runs']

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
  && (item.assets === undefined || isRecord(item.assets))
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

const normalizeWorkflowNodes = (nodes: WorkflowNodeType[]): WorkflowNodeType[] => nodes.map((node) => node.data.kind === 'catalyst'
  ? { ...node, data: { ...node.data, instruction: '', overrides: {}, execution: {} } }
  : node)

const emptyGraph = (): { nodes: WorkflowNodeType[]; edges: WorkflowEdgeType[] } => ({ nodes: [], edges: [] })

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

interface WorkspaceProps {
  project: ProjectContext
  onUpdateProject: (project: ProjectContext) => void
  components: ComponentTemplate[]
  modules: WorkflowModuleDefinition[]
  onCreateModule: (module: WorkflowModuleDefinition) => void
  onImportComponents: (components: ComponentTemplate[]) => void
  onImportModules: (modules: WorkflowModuleDefinition[]) => void
  onNavigate: (page: AppPage) => void
  onComposeModule: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  workflowId: string
  document?: WorkflowDocument
  onSaveWorkflow: (document: WorkflowDocument, record: WorkflowRecord) => boolean
  onPrepareRun: (run: PendingRun) => void
  startingTemplate?: WorkflowTemplate
  workflows: WorkflowRecord[]
  catalysts: CatalystDefinition[]
  onToggleCatalyst: (id: string) => void
  onBindCatalyst: (id: string, workflowId: string, workflowName: string) => void
}

function graphFromTemplate(template: WorkflowTemplate | undefined, components: ComponentTemplate[], modules: WorkflowModuleDefinition[]) {
  if (!template) return emptyGraph()
  const lookup = Object.fromEntries(components.map((component) => [component.id, component]))
  const moduleLookup = Object.fromEntries(moduleComponentTemplates(modules).map((component) => [component.moduleId!, component]))
  const selected = template.moduleIds?.length
    ? template.moduleIds.map((id) => moduleLookup[id]).filter(Boolean)
    : template.componentIds.map((id) => lookup[id]).filter(Boolean)
  if (!selected.length) return emptyGraph()

  const nodes = selected.map((component, index) => nodeFromTemplate(
    component,
    `${component.id}-${index + 1}`,
    { x: 48 + index * 384, y: 240 },
  ))
  const edges = nodes.slice(0, -1).map((node, index) => edge(
    `${node.id}-${nodes[index + 1].id}`,
    node.id,
    nodes[index + 1].id,
    {
      data: { tone: 'default', trigger: 'always', handoff: DEFAULT_HANDOFF },
    },
  ))
  return { nodes, edges }
}

function Workspace({ project, onUpdateProject, components, modules, onCreateModule, onImportComponents, onImportModules, onNavigate, onComposeModule, theme, onToggleTheme, workflowId, document: savedDocument, onSaveWorkflow, onPrepareRun, startingTemplate, workflows, catalysts, onToggleCatalyst, onBindCatalyst }: WorkspaceProps) {
  const [restoredDocument] = useState(() => savedDocument ?? null)
  const startingGraph = restoredDocument
    ? { nodes: normalizeWorkflowNodes(restoredDocument.nodes), edges: normalizeEdges(restoredDocument.edges) }
    : graphFromTemplate(startingTemplate, components, modules)
  const [nodes, setNodes, onNodesChange] = useNodesState(startingGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(startingGraph.edges)
  const [workflowName, setWorkflowName] = useState(restoredDocument?.name ?? startingTemplate?.name ?? 'Untitled workflow')
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
    const id = instanceId(template.id)
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
    const definition: WorkflowModuleDefinition = {
      id: uniqueId(draft.name, (candidate) => modules.some((item) => item.id === candidate), 'module'),
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
  }, [edges, modules, nodes, onCreateModule, showToast])

  const expandModule = useCallback((nodeId: string) => {
    const container = nodes.find((node) => node.id === nodeId)
    const definition = container?.data.module ? moduleLookup[container.data.module.moduleId] : undefined
    if (!container || !definition) return
    const ids = Object.fromEntries(definition.nodes.map((item) => [item.id, instanceId(`${nodeId}-${item.id}`)]))
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
    // Why: a component missing from the workspace is skipped above, so every edge has to be checked
    // against what was actually created. Emitting the rest verbatim produced transitions pointing at
    // node ids that do not exist, which the graph validator then rejected on save.
    const created = new Set(expanded.map((node) => node.id))
    const resolved = (moduleNodeId: string) => created.has(ids[moduleNodeId]) ? ids[moduleNodeId] : undefined
    const internalEdges = definition.edges.reduce<WorkflowEdgeType[]>((result, item) => {
      const source = resolved(item.source)
      const target = resolved(item.target)
      if (source && target) result.push(edge(instanceId(`${nodeId}-${item.id}`), source, target, { data: normalizeEdgeData(item.data) }))
      return result
    }, [])
    const entryIds = definition.entryNodeIds.map(resolved).filter((id): id is string => Boolean(id))
    const exitIds = definition.exitNodeIds.map(resolved).filter((id): id is string => Boolean(id))
    const incoming = edges.filter((item) => item.target === nodeId).flatMap((item) => entryIds.map((entryId) => ({ ...item, id: instanceId(`${item.id}-expanded`), target: entryId })))
    const outgoing = edges.filter((item) => item.source === nodeId).flatMap((item) => exitIds.map((exitId) => ({ ...item, id: instanceId(`${item.id}-expanded`), source: exitId })))
    const dropped = definition.nodes.length - expanded.length
    setNodes((current) => [...current.filter((node) => node.id !== nodeId), ...expanded])
    setEdges((current) => [...current.filter((item) => item.source !== nodeId && item.target !== nodeId), ...internalEdges, ...incoming, ...outgoing])
    setSelectedNodeId(null)
    setSaveState('saving')
    window.setTimeout(() => fitView({ padding: 0.15, duration: 450 }), 30)
    if (dropped) showToast(`${definition.name} expanded · ${dropped} step${dropped === 1 ? '' : 's'} left out, their components are missing from the workspace`, 'error')
    else showToast(`${definition.name} expanded into editable components`)
  }, [componentLookup, edges, fitView, moduleLookup, nodes, setEdges, setNodes, showToast])

  const onConnect = useCallback((connection: Connection) => {
    if (nodes.some((node) => node.id === connection.target && node.data.kind === 'catalyst')) {
      showToast('A Catalyst is a starting point and cannot receive a transition.', 'error')
      return
    }
    setEdges((current) => addEdge({
      ...connection,
      id: instanceId('edge'),
      type: 'workflow',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      data: { tone: 'default', trigger: 'always', handoff: DEFAULT_HANDOFF },
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

  const saveWorkflow = useCallback(() => {
    if (!workflowName.trim()) {
      showToast('Add a workflow name before saving.', 'error')
      return false
    }
    if (!nodes.length) {
      showToast('Add at least one component before saving.', 'error')
      return false
    }
    setSaveState('saving')
    const saved = onSaveWorkflow(documentForExport(), {
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
    if (!saved) {
      setSaveState('saved')
      showToast('Could not save in this browser. Check storage permissions.', 'error')
      return false
    }
    setSaveState('saved')
    showToast('Workflow saved locally')
    return true
  }, [documentForExport, isCatalystEntrypointValid, nodes, onSaveWorkflow, project.name, project.root, showToast, startingTemplate?.description, workflowId, workflowName])

  const exportWorkflow = useCallback(() => {
    const blob = new Blob([JSON.stringify(assignmentForExport(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${slugify(workflowName) || 'workflow'}.relay.json`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('Driver-ready assignment exported')
  }, [assignmentForExport, showToast, workflowName])

  const openProjectConfig = useCallback(() => {
    if (saveWorkflow()) onNavigate('projects')
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

  const stageCatalystWorkflow = useCallback(() => {
    if (!validateWorkflow()) return
    if (!saveWorkflow()) return
    const runId = instanceId('run')
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
      setEdges(normalizeEdges(imported.edges))
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

  const runWorkflow = useCallback((configuration: RunConfiguration) => {
    setKickoffTask(configuration.task)
    const runId = instanceId('run')
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
            ? <button className="run-button" onClick={stageCatalystWorkflow}><Zap size={14} fill="currentColor" /> Stage</button>
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
          <button className="save-button" onClick={() => { saveWorkflow() }}>
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
          <Library components={authoringComponents} onAdd={addComponent} onCollapse={() => setLibraryOpen(false)} onNewComponent={() => onNavigate('components')} onNewModule={onComposeModule} />
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
            snapToGrid
            snapGrid={snapGrid}
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
          onOpenProjectConfig={openProjectConfig}
          onOpenCatalysts={stageCatalystWorkflow}
          onToggleCatalyst={onToggleCatalyst}
          onBindCatalyst={(id) => onBindCatalyst(id, workflowId, workflowName)}
          modules={modules}
          onExpandModule={expandModule}
        />
        <TransitionInspector
          edge={selectedEdge}
          sourceNode={selectedEdgeSource}
          targetNode={selectedEdgeTarget}
          onClose={() => setSelectedEdgeId(null)}
          onUpdateEdge={updateEdge}
        />
      </div>
      {startRunOpen && <StartRunModal workflowName={workflowName} projectName={project.name} onClose={() => setStartRunOpen(false)} onStart={(configuration) => { setStartRunOpen(false); runWorkflow(configuration) }} />}
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
  // Why: these read per item, not per collection. One asset written by an older build used to fail
  // the whole-array guard and silently wipe the user's entire library on boot.
  const [customComponents, setCustomComponents] = useState<ComponentTemplate[]>(() => readStoredItems('relay.components', isComponentTemplate))
  const [customModules, setCustomModules] = useState<WorkflowModuleDefinition[]>(() => readStoredItems('relay.modules', isWorkflowModuleDefinition))
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => readStored('relay.workflows', [], isWorkflowRecordList)
    .filter((workflow) => workflow.source !== 'starter'))
  const [userTemplates, setUserTemplates] = useState<WorkflowTemplate[]>(() => readStored('relay.userTemplates', [], isWorkflowTemplateList))
  // Why: one document per workflow id. The old single 'relay.workflow' slot meant a second workflow
  // silently overwrote the first, which also made nesting a saved workflow impossible.
  const [documents, setDocuments] = useState<WorkflowDocument[]>(() => {
    const saved = readStoredItems('relay.documents', isWorkflowDocument)
    if (saved.length) return saved
    const legacy = readStored<WorkflowDocument | null>('relay.workflow', null, (value): value is WorkflowDocument | null => value === null || isWorkflowDocument(value))
    return legacy ? [legacy] : []
  })
  const [builderTemplate, setBuilderTemplate] = useState<WorkflowTemplate | undefined>(undefined)
  const [builderWorkflowId, setBuilderWorkflowId] = useState<string | null>(null)
  const [composingModuleId, setComposingModuleId] = useState<string | null>(null)
  const [stagedRuns, setStagedRuns] = useState<PendingRun[]>(() => {
    const saved = readStoredItems('relay.stagedRuns', isPendingRun)
    if (saved.length) return saved
    const legacy = readStored<PendingRun | null>('relay.pendingRun', null, (value): value is PendingRun | null => value === null || isPendingRun(value))
    return legacy ? [{ ...legacy, state: 'staged' }] : []
  })
  const [catalysts, setCatalysts] = useState<CatalystDefinition[]>(() => readStoredItems('relay.catalysts', isCatalystDefinition))
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
  // Why: edits to a seeded asset are stored as a user override keyed by id. Substituting the override
  // in place (instead of filter + append) keeps a card from jumping to the end of the grid on save.
  const components = useMemo(() => {
    const overrides = new Map(customComponents.map((item) => [item.id, item]))
    const seededIds = new Set(componentLibrary.map((item) => item.id))
    return [
      ...componentLibrary.map((item) => overrides.get(item.id) ?? item),
      ...customComponents.filter((item) => !seededIds.has(item.id)),
    ]
  }, [customComponents])
  const modules = useMemo(() => {
    const overrides = new Map(customModules.map((item) => [item.id, item]))
    const seededIds = new Set(builtInModules.map((item) => item.id))
    return [
      ...builtInModules.map((item) => overrides.get(item.id) ?? item),
      ...customModules.filter((item) => !seededIds.has(item.id)),
    ]
  }, [customModules])

  // Why: the repo directories are the contract with the CLI and with agents. When the dev bridge is
  // available it wins over localStorage on boot, and every later change is mirrored back to disk.
  const [fileBridge, setFileBridge] = useState<{ status: 'checking' | 'files' | 'browser'; root?: string; problems: string[] }>({ status: 'checking', problems: [] })
  const mirrored = useRef<{ components: ComponentTemplate[]; modules: WorkflowModuleDefinition[]; templates: WorkflowTemplate[]; documents: WorkflowDocument[]; catalysts: CatalystDefinition[] } | null>(null)
  const browserState = useRef({ components: customComponents, modules: customModules, templates: userTemplates, documents, catalysts })
  browserState.current = { components: customComponents, modules: customModules, templates: userTemplates, documents, catalysts }
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const workspace: WorkspaceFiles | null = await readWorkspaceFiles()
      if (cancelled) return
      if (!workspace) {
        setFileBridge({ status: 'browser', problems: [] })
        return
      }
      // Why: adopt per collection. Disk wins wherever it has files; anything authored browser-only
      // in an empty directory is kept and written out, never silently shadowed by an empty repo.
      const browser = browserState.current
      const components = workspace.components.length ? workspace.components : browser.components
      const modules = workspace.modules.length ? workspace.modules : browser.modules
      const templates = workspace.templates.length ? workspace.templates : browser.templates
      const workflowDocuments = workspace.documents.length ? workspace.documents : browser.documents
      const workspaceCatalysts = workspace.catalysts.length ? workspace.catalysts : browser.catalysts
      setCustomComponents(components)
      setCustomModules(modules)
      setUserTemplates(templates)
      setDocuments(workflowDocuments)
      setCatalysts(workspaceCatalysts)
      // Why: with files as the source of truth the workflow list is derived from the documents on
      // disk, so a graph an agent wrote shows up without a separate record to drift out of sync.
      if (workspace.documents.length) {
        setWorkflows((current) => workflowDocuments.map((item) => {
          const existing = current.find((record) => record.id === item.id)
          return {
            id: item.id,
            name: item.name,
            description: item.description,
            nodeCount: item.nodes.length,
            projectName: item.project.root ? item.project.name : existing?.projectName,
            updatedAt: item.updatedAt,
            status: 'ready' as const,
            source: existing?.source ?? 'imported' as const,
            entryMode: item.entry?.mode === 'catalyst' ? 'catalyst' as const : 'manual' as const,
            steps: item.nodes.filter((node) => node.data.kind !== 'catalyst').map((node) => node.data.label),
          }
        }))
      }
      // Seed the mirror with what disk actually holds so adopted assets get written on the next tick.
      mirrored.current = {
        components: workspace.components,
        modules: workspace.modules,
        templates: workspace.templates,
        documents: workspace.documents,
        catalysts: workspace.catalysts,
      }
      setFileBridge({ status: 'files', root: workspace.root, problems: workspace.problems })
    }
    void load()
    const stop = onWorkspaceFilesChanged(() => { void load() })
    return () => { cancelled = true; stop() }
  }, [])

  // Why: mirroring is serialized through one promise chain. Typing in an editor fires this effect on
  // every keystroke, and overlapping runs could interleave a write with the delete of the same file.
  const mirrorQueue = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => {
    if (fileBridge.status !== 'files') return
    const previous = mirrored.current ?? { components: [], modules: [], templates: [], documents: [], catalysts: [] }
    const next = { components: customComponents, modules: customModules, templates: userTemplates, documents, catalysts }
    mirrored.current = next
    mirrorQueue.current = mirrorQueue.current.then(async () => {
      const problems = [
        ...await syncCollection('components', next.components, previous.components, serializeComponent),
        ...await syncCollection('modules', next.modules, previous.modules, serializeModule),
        ...await syncCollection('templates', next.templates, previous.templates, serializeTemplate),
        ...await syncCollection('workflows', next.documents, previous.documents, serializeDocument),
        ...await syncCollection('catalysts', next.catalysts, previous.catalysts, serializeCatalyst),
      ]
      // Surfacing this matters: a silent failure means the repo and the open page have diverged.
      if (problems.length) setFileBridge((current) => current.status === 'files'
        ? { ...current, problems: [...new Set([...current.problems, ...problems])] }
        : current)
    }).catch(() => undefined)
  }, [catalysts, customComponents, customModules, userTemplates, documents, fileBridge.status])

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
  useEffect(() => { writeStored('relay.documents', documents) }, [documents])
  useEffect(() => { writeStored('relay.catalysts', catalysts) }, [catalysts])
  useEffect(() => { writeStored('relay.monitorBoard', monitorBoard) }, [monitorBoard])
  useEffect(() => { writeStored('relay.stagedRuns', stagedRuns) }, [stagedRuns])
  useEffect(() => { removeStored('relay.pendingRun'); removeStored('relay.workflow') }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem('relay.theme', theme) } catch { /* Theme still applies for this session. */ }
  }, [theme])

  const navigate = (nextPage: AppPage) => {
    const destination = nextPage === 'catalysts' ? 'components' : nextPage
    window.location.hash = `/${destination}`
    setPage(destination)
  }
  const mergeComponents = (incoming: ComponentTemplate[], review = false) => {
    setCustomComponents((current) => {
      const merged = new Map(current.map((item) => [item.id, item]))
      incoming.forEach((item) => merged.set(item.id, review ? markForReview(item) : item))
      return [...merged.values()]
    })
  }
  const mergeModules = (incoming: WorkflowModuleDefinition[], review = false) => {
    setCustomModules((current) => {
      const merged = new Map(current.map((item) => [item.id, item]))
      incoming.forEach((item) => merged.set(item.id, review ? markForReview({ ...item, source: 'user' as const }) : { ...item, source: 'user' as const }))
      return [...merged.values()]
    })
  }
  const importAssets = (assets: ParsedAssets) => {
    if (assets.components.length) mergeComponents(assets.components, true)
    if (assets.modules.length) mergeModules(assets.modules, true)
    if (assets.templates.length) setUserTemplates((current) => {
      const merged = new Map(current.map((item) => [item.id, item]))
      assets.templates.forEach((item) => merged.set(item.id, item))
      return [...merged.values()]
    })
  }
  // Why: a template must work on an empty install, so using one clones the assets it carries into
  // the workspace before the builder resolves its graph.
  const useTemplate = (template: WorkflowTemplate) => {
    if (template.assets?.components?.length) mergeComponents(template.assets.components)
    if (template.assets?.modules?.length) mergeModules(template.assets.modules)
    const workflowId = uniqueWorkflowId(template.name || template.id)
    const captured = template.assets?.workflow
    if (captured) {
      // Seed a document copy so the builder restores the captured graph verbatim.
      const seeded: WorkflowDocument = { ...captured, id: workflowId, name: template.name, updatedAt: new Date().toISOString() }
      const next = [...documents.filter((item) => item.id !== workflowId), seeded]
      if (writeStored('relay.documents', next)) setDocuments(next)
      setBuilderTemplate(undefined)
    } else {
      setBuilderTemplate(template)
    }
    setBuilderWorkflowId(workflowId)
    navigate('builder')
  }

  const uniqueWorkflowId = (candidate: string, keepId?: string) => uniqueId(
    candidate,
    (id) => id !== keepId && (workflows.some((item) => item.id === id) || documents.some((item) => item.id === id)),
    'workflow',
  )
  // Why: a workflow's id follows its name, so every place that points at it has to be retargeted in
  // the same commit — nested workflow nodes, bound catalysts, and staged runs.
  const retargetReferences = (docs: WorkflowDocument[], fromId: string, toId: string) => docs.map((item) => ({
    ...item,
    nodes: item.nodes.map((node) => node.data.subworkflow?.workflowId === fromId
      ? {
        ...node,
        data: {
          ...node.data,
          templateId: node.data.templateId === `workflow-ref-${fromId}` ? `workflow-ref-${toId}` : node.data.templateId,
          subworkflow: { ...node.data.subworkflow, workflowId: toId },
        },
      }
      : node),
  }))

  const saveWorkflow = (document: WorkflowDocument, record: WorkflowRecord): boolean => {
    const fromId = document.id
    const toId = uniqueWorkflowId(record.name, fromId)
    const saved = { ...document, id: toId }
    const others = retargetReferences(documents.filter((item) => item.id !== fromId), fromId, toId)
    const next = [...others, saved]
    if (!writeStored('relay.documents', next)) return false
    setDocuments(next)
    setWorkflows((current) => {
      const without = current.filter((item) => item.id !== fromId && item.id !== toId)
      return [{ ...record, id: toId }, ...without]
    })
    if (toId !== fromId) {
      setCatalysts((current) => current.map((item) => item.workflowId === fromId ? { ...item, workflowId: toId, workflowName: record.name } : item))
      setStagedRuns((current) => current.map((item) => item.workflowId === fromId ? { ...item, workflowId: toId, workflowName: record.name } : item))
      setBuilderWorkflowId(toId)
    }
    // The graph is now the saved document, so a remount must not rebuild it from the template.
    setBuilderTemplate(undefined)
    return true
  }

  const workflowsNesting = (workflowId: string) => documents
    .filter((item) => item.id !== workflowId && item.nodes.some((node) => node.data.subworkflow?.workflowId === workflowId))
    .map((item) => item.name)

  const deleteWorkflow = (workflow: WorkflowRecord) => {
    const next = documents.filter((item) => item.id !== workflow.id)
    if (!writeStored('relay.documents', next)) return
    setDocuments(next)
    setWorkflows((current) => current.filter((item) => item.id !== workflow.id))
    setStagedRuns((current) => current.filter((item) => item.workflowId !== workflow.id))
    setCatalysts((current) => current.map((item) => item.workflowId === workflow.id ? { ...item, workflowId: undefined, workflowName: undefined } : item))
    if (builderWorkflowId === workflow.id) setBuilderWorkflowId(null)
  }

  // Why: a template is a snapshot of a workflow, not an ordering of modules — the graph carries the
  // transitions, gates, and loop limits that an ordered list would silently discard.
  const buildTemplateFromWorkflow = (
    workflowId: string,
    draft: { name: string; description: string; level: WorkflowTemplate['level']; published: boolean },
  ): { template?: WorkflowTemplate; error?: string } => {
    const document = documents.find((item) => item.id === workflowId)
    if (!document) return { error: 'That workflow has no saved graph yet. Open it in the builder and save first.' }
    if (!document.nodes.length) return { error: 'That workflow has no steps yet.' }
    const nested = document.nodes.filter((node) => node.data.subworkflow).map((node) => node.data.label)
    if (nested.length) return { error: `Nested workflows cannot be carried in a template yet: ${nested.join(', ')}. Expand or remove them first.` }

    const usedModuleIds = new Set(document.nodes.map((node) => node.data.module?.moduleId).filter((id): id is string => Boolean(id)))
    const usedModules = modules.filter((item) => usedModuleIds.has(item.id))
    const usedComponentIds = new Set([
      ...document.nodes.filter((node) => node.data.kind !== 'module' && node.data.kind !== 'catalyst').map((node) => node.data.templateId),
      ...usedModules.flatMap((item) => item.nodes.map((node) => node.componentId)),
    ])
    const usedComponents = components.filter((item) => usedComponentIds.has(item.id))

    const id = uniqueTemplateId(draft.name)
    return {
      template: {
        id,
        name: draft.name,
        description: draft.description,
        level: draft.level,
        steps: document.nodes.filter((node) => node.data.kind !== 'catalyst').map((node) => node.data.label),
        componentIds: usedComponents.map((item) => item.id),
        moduleIds: usedModules.map((item) => item.id),
        adaptationRules: [],
        source: 'user',
        published: draft.published,
        createdAt: new Date().toISOString(),
        assets: { components: usedComponents, modules: usedModules, workflow: { ...document, id } },
      },
    }
  }

  const uniqueTemplateId = (candidate: string) => uniqueId(candidate, (id) => userTemplates.some((item) => item.id === id), 'template')

  // Why: deleting an asset can strand a graph, so every delete reports what points at it first.
  const componentUsage = (componentId: string) => [
    ...modules.filter((item) => item.nodes.some((node) => node.componentId === componentId)).map((item) => item.name),
    ...documents.filter((item) => item.nodes.some((node) => node.data.templateId === componentId)).map((item) => item.name),
  ]
  const moduleUsage = (moduleId: string) => [
    ...documents.filter((item) => item.nodes.some((node) => node.data.module?.moduleId === moduleId)).map((item) => item.name),
    ...userTemplates.filter((item) => (item.moduleIds ?? []).includes(moduleId)).map((item) => item.name),
  ]
  const catalystUsage = (catalystId: string) => documents
    .filter((item) => item.nodes.some((node) => node.data.catalyst?.definitionId === catalystId))
    .map((item) => item.name)

  const deleteComponent = (componentId: string) => setCustomComponents((current) => current.filter((item) => item.id !== componentId))
  const deleteModule = (moduleId: string) => setCustomModules((current) => current.filter((item) => item.id !== moduleId))
  const deleteCatalyst = (catalystId: string) => setCatalysts((current) => current.filter((item) => item.id !== catalystId))

  const openWorkflow = (workflow: WorkflowRecord) => {
    setBuilderTemplate(undefined)
    setBuilderWorkflowId(workflow.id)
    navigate('builder')
  }
  const openNewWorkflow = () => {
    setBuilderTemplate(undefined)
    setBuilderWorkflowId(uniqueWorkflowId('untitled-workflow'))
    navigate('builder')
  }

  const stageSavedWorkflow = (workflow: WorkflowRecord, configuration: RunConfiguration) => {
    const savedDocument = documents.find((item) => item.id === workflow.id)
    const graph = savedDocument ? snapshotWithSpecification(savedDocument.nodes, savedDocument.edges) : undefined
    const runId = instanceId('run')
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

  if (page === 'module-builder') {
    const composing = modules.find((item) => item.id === composingModuleId) ?? null
    return (
      <ReactFlowProvider>
        <ModuleComposer
          key={composing?.id ?? 'new-module'}
          module={composing}
          modules={modules}
          components={components}
          project={project}
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          onSave={(module) => {
            setCustomModules((current) => [module, ...current.filter((item) => item.id !== module.id)])
            setComposingModuleId(null)
            navigate('components')
          }}
          onExit={() => { setComposingModuleId(null); navigate('components') }}
          onNewComponent={() => { setComposingModuleId(null); navigate('components') }}
        />
      </ReactFlowProvider>
    )
  }

  if (page === 'builder') {
    // Falling back to the most recently updated document keeps "Open builder" on the last thing edited.
    const mostRecent = [...documents].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0]
    const activeWorkflowId = builderWorkflowId ?? mostRecent?.id ?? 'untitled-workflow'
    return (
      <ReactFlowProvider>
        <Workspace
          key={`${activeWorkflowId}-${builderTemplate?.id ?? 'none'}`}
          workflowId={activeWorkflowId}
          document={builderTemplate ? undefined : documents.find((item) => item.id === activeWorkflowId)}
          onSaveWorkflow={saveWorkflow}
          project={project}
          onUpdateProject={setProject}
          components={components}
          modules={modules}
          onCreateModule={(module) => setCustomModules((current) => [module, ...current.filter((item) => item.id !== module.id)])}
          onImportComponents={mergeComponents}
          onImportModules={mergeModules}
          onNavigate={navigate}
          onComposeModule={() => { setComposingModuleId(null); navigate('module-builder') }}
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          onPrepareRun={(run) => setStagedRuns((current) => [run, ...current.filter((item) => item.id !== run.id)])}
          startingTemplate={builderTemplate}
          workflows={workflows}
          catalysts={catalysts}
          onToggleCatalyst={(id) => setCatalysts((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'paused' ? 'awaiting-runner' : 'paused' } : item))}
          onBindCatalyst={(id, boundWorkflowId, boundWorkflowName) => setCatalysts((current) => current.map((item) => item.id === id ? { ...item, workflowId: boundWorkflowId, workflowName: boundWorkflowName } : item))}
        />
      </ReactFlowProvider>
    )
  }

  return (
    <Management
      page={page}
      onNavigate={navigate}
      onComposeModule={(moduleId) => { setComposingModuleId(moduleId); navigate('module-builder') }}
      project={project}
      onUpdateProject={setProject}
      components={components}
      modules={modules}
      onCreateComponent={(component) => setCustomComponents((current) => current.some((item) => item.id === component.id)
        ? current.map((item) => item.id === component.id ? component : item)
        : [...current, component])}
      onCreateModule={(module) => setCustomModules((current) => current.some((item) => item.id === module.id)
        ? current.map((item) => item.id === module.id ? module : item)
        : [module, ...current])}
      theme={theme}
      onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      workflows={workflows}
      templates={[...userTemplates, ...builtInTemplates]}
      onCreateTemplate={(template) => setUserTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)])}
      onToggleTemplatePublished={(id) => setUserTemplates((current) => current.map((template) => template.id === id ? { ...template, published: !template.published } : template))}
      onUseTemplate={useTemplate}
      onOpenWorkflow={openWorkflow}
      onNewWorkflow={openNewWorkflow}
      onDeleteWorkflow={deleteWorkflow}
      workflowsNesting={workflowsNesting}
      buildTemplateFromWorkflow={buildTemplateFromWorkflow}
      fileBridge={fileBridge}
      onDeleteComponent={deleteComponent}
      onDeleteModule={deleteModule}
      onDeleteCatalyst={deleteCatalyst}
      componentUsage={componentUsage}
      moduleUsage={moduleUsage}
      catalystUsage={catalystUsage}
      onImportAssets={importAssets}
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
