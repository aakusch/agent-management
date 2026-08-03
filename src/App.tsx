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
  Plus,
  Sparkles,
  Sun,
} from 'lucide-react'
import { Inspector } from './components/Inspector'
import { Library } from './components/Library'
import { Management, type AppPage } from './components/Management'
import { StartRunModal, type RunConfiguration } from './components/StartRunModal'
import { TransitionInspector } from './components/TransitionInspector'
import { WorkflowEdge } from './components/WorkflowEdge'
import { WorkflowNode } from './components/WorkflowNode'
import { componentById, componentLibrary } from './data/library'
import { builtInTemplates } from './data/templates'
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
}

const starterWorkflow: WorkflowRecord = {
  id: 'implementation-quality-loop',
  name: 'Implementation quality loop',
  description: 'Implement, review in parallel, revise when required, and prepare a handoff.',
  nodeCount: 5,
  status: 'ready',
  source: 'starter',
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
  const startingGraph = graphFromTemplate(startingTemplate, components)
  const [nodes, setNodes, onNodesChange] = useNodesState(startingGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(startingGraph.edges)
  const [workflowName, setWorkflowName] = useState(startingTemplate?.name ?? 'Implementation quality loop')
  const [workflowId] = useState(startingTemplate?.id ?? 'implementation-quality-loop')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [startRunOpen, setStartRunOpen] = useState(false)
  const [kickoffTask, setKickoffTask] = useState('')
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [toast, setToast] = useState<string | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
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

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

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
    setEdges((current) => addEdge({
      ...connection,
      id: `edge-${Date.now()}`,
      type: 'workflow',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      data: { tone: 'default', trigger: 'always', payload: { mode: 'all' }, onBlocked: 'wait' },
    }, current))
    setSaveState('saving')
  }, [setEdges])

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
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  }), [edges, nodes, project, workflowId, workflowName])

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
        concurrency: 3,
        stateDirectory: '.relay/runs/{{run.id}}',
        eventLog: '.relay/runs/{{run.id}}/events.jsonl',
        artifactDirectory: '.relay/runs/{{run.id}}/artifacts',
        checkpointAfterEachNode: true,
        stopConditions: {
          maxTotalSteps: 24,
          maxDurationMinutes: 60,
          stopOnNoProgress: 2,
          requireHumanOnExhaustion: true,
        },
        permissions: {
          spawnAgents: true,
          shell: 'project',
          network: 'ask',
          publish: 'ask',
        },
      },
    }
  }, [authoringComponents, documentForExport, kickoffTask, nodes, workflowName])

  const saveWorkflow = useCallback(async () => {
    setSaveState('saving')
    localStorage.setItem('relay.workflow', JSON.stringify(documentForExport()))
    onWorkflowSaved({
      id: workflowId,
      name: workflowName,
      description: 'Implement, review in parallel, revise when required, and prepare a handoff.',
      nodeCount: nodes.length,
      projectName: project.root ? project.name : undefined,
      updatedAt: new Date().toISOString(),
      status: 'ready',
      source: 'local',
      steps: nodes.map((node) => node.data.label),
    })
    await sleep(350)
    setSaveState('saved')
    showToast('Workflow saved locally')
  }, [documentForExport, nodes, onWorkflowSaved, project.name, project.root, showToast, workflowId, workflowName])

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

  const importWorkflow = useCallback(async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as WorkflowDocument | RelayAssignmentBundle
      const bundle = (parsed as RelayAssignmentBundle).kind === 'relay.assignment'
        ? parsed as RelayAssignmentBundle
        : null
      const imported: WorkflowDocument = bundle ? bundle.workflow : parsed as WorkflowDocument
      if (imported.schemaVersion !== '1.0' || !Array.isArray(imported.nodes) || !Array.isArray(imported.edges)) {
        throw new Error('Unsupported workflow document')
      }
      setNodes(imported.nodes)
      setEdges(imported.edges)
      onUpdateProject(imported.project)
      if (bundle) onImportComponents(bundle.components)
      setWorkflowName(imported.name)
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      window.setTimeout(() => fitView({ padding: 0.16, duration: 500 }), 50)
      showToast('Workflow imported')
    } catch {
      showToast('Could not import this workflow')
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
      <header className="topbar">
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
          <button className="subtle-button header-action" onClick={() => onNavigate('projects')}><Plus size={15} /> Variable</button>
          <button className="run-button" onClick={() => setStartRunOpen(true)}><Play size={14} fill="currentColor" /> Run workflow</button>
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
          <div className="overflow-wrap">
            <button className="icon-button" onClick={() => setOverflowOpen((open) => !open)} aria-label="More workflow actions" aria-expanded={overflowOpen}><MoreHorizontal size={18} /></button>
            {overflowOpen && <div className="overflow-menu">
              <button onClick={() => { importInput.current?.click(); setOverflowOpen(false) }}><Import size={15} /><span><strong>Import workflow</strong><small>Open a JSON or Relay assignment</small></span></button>
              <button onClick={() => { exportWorkflow(); setOverflowOpen(false) }}><Download size={15} /><span><strong>Export assignment</strong><small>Download the driver-ready bundle</small></span></button>
              <button onClick={() => { onNavigate('runs'); setOverflowOpen(false) }}><Cloud size={15} /><span><strong>View runs</strong><small>Open live and prepared runs</small></span></button>
            </div>}
          </div>
        </div>
      </header>

      <div className="workspace-body">
        {libraryOpen ? (
          <Library components={authoringComponents} onAdd={addComponent} onCollapse={() => setLibraryOpen(false)} onNewComponent={() => onNavigate('components')} />
        ) : (
          <button className="open-library" onClick={() => setLibraryOpen(true)} aria-label="Open component library">
            <Menu size={17} />
          </button>
        )}

        <section className="canvas-shell">
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
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(node) => `var(--${String(node.data?.color ?? 'mint')})`}
              maskColor={theme === 'light' ? 'rgba(236, 240, 242, .78)' : 'rgba(7, 9, 12, .76)'}
            />
          </ReactFlow>

          <div className="canvas-tip"><Box size={14} /> Drag components onto the canvas · connect handles to define flow</div>
        </section>

        <Inspector
          node={selectedNode}
          project={project}
          onClose={() => setSelectedNodeId(null)}
          onUpdateNode={updateNode}
          onUpdateProject={(nextProject) => { onUpdateProject(nextProject); setSaveState('saving') }}
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
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </main>
  )
}

function GitFlowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v10a4 4 0 0 0 4 4h8M6 10h7a4 4 0 0 0 4-4V4M4 4h4M16 2v4h4M16 16v4h4" /></svg>
}

export default function App() {
  const validPages: AppPage[] = ['dashboard', 'builder', 'workflows', 'components', 'projects', 'templates', 'catalysts', 'runs']
  const pageFromHash = () => {
    const candidate = window.location.hash.replace('#/', '') as AppPage
    return validPages.includes(candidate) ? candidate : 'dashboard'
  }
  const [page, setPage] = useState<AppPage>(pageFromHash)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('relay.theme') === 'light' ? 'light' : 'dark')
  const [project, setProject] = useState<ProjectContext>(() => {
    const saved = localStorage.getItem('relay.project')
    if (!saved) return projectSeed
    const parsed = JSON.parse(saved) as ProjectContext
    return parsed.name === 'Acme storefront' && parsed.root === './' ? projectSeed : parsed
  })
  const [customComponents, setCustomComponents] = useState<ComponentTemplate[]>(() => {
    const saved = localStorage.getItem('relay.components')
    return saved ? JSON.parse(saved) as ComponentTemplate[] : []
  })
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => {
    const saved = localStorage.getItem('relay.workflows')
    return saved ? JSON.parse(saved) as WorkflowRecord[] : [starterWorkflow]
  })
  const [userTemplates, setUserTemplates] = useState<WorkflowTemplate[]>(() => {
    const saved = localStorage.getItem('relay.userTemplates')
    return saved ? JSON.parse(saved) as WorkflowTemplate[] : []
  })
  const [builderTemplate, setBuilderTemplate] = useState<WorkflowTemplate | undefined>(undefined)
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(() => {
    const saved = localStorage.getItem('relay.pendingRun')
    return saved ? JSON.parse(saved) as PendingRun : null
  })
  const [catalysts, setCatalysts] = useState<CatalystDefinition[]>(() => {
    const saved = localStorage.getItem('relay.catalysts')
    return saved ? JSON.parse(saved) as CatalystDefinition[] : []
  })
  const [monitorBoard, setMonitorBoard] = useState<RunMonitorBoard>(() => {
    const saved = localStorage.getItem('relay.monitorBoard')
    if (saved) return JSON.parse(saved) as RunMonitorBoard
    return {
      name: 'Codebase runs',
      columns: 2,
      groups: [{ id: 'workspace', name: 'Workspace', projectName: project.root ? project.name : undefined }],
      tiles: [],
    }
  })
  const components = useMemo(() => {
    const customIds = new Set(customComponents.map((item) => item.id))
    return [...componentLibrary.filter((item) => !customIds.has(item.id)), ...customComponents]
  }, [customComponents])

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  })
  useEffect(() => localStorage.setItem('relay.project', JSON.stringify(project)), [project])
  useEffect(() => localStorage.setItem('relay.components', JSON.stringify(customComponents)), [customComponents])
  useEffect(() => localStorage.setItem('relay.workflows', JSON.stringify(workflows)), [workflows])
  useEffect(() => localStorage.setItem('relay.userTemplates', JSON.stringify(userTemplates)), [userTemplates])
  useEffect(() => localStorage.setItem('relay.catalysts', JSON.stringify(catalysts)), [catalysts])
  useEffect(() => localStorage.setItem('relay.monitorBoard', JSON.stringify(monitorBoard)), [monitorBoard])
  useEffect(() => {
    if (pendingRun) localStorage.setItem('relay.pendingRun', JSON.stringify(pendingRun))
    else localStorage.removeItem('relay.pendingRun')
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
    localStorage.setItem('relay.theme', theme)
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
      onUseTemplate={(template) => { setBuilderTemplate(template); navigate('builder') }}
      pendingRun={pendingRun}
      monitorBoard={monitorBoard}
      onUpdateMonitorBoard={setMonitorBoard}
      catalysts={catalysts}
      onCreateCatalyst={(catalyst) => setCatalysts((current) => [catalyst, ...current.filter((item) => item.id !== catalyst.id)])}
      onToggleCatalyst={(id) => setCatalysts((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'paused' ? 'awaiting-runner' : 'paused' } : item))}
    />
  )
}
