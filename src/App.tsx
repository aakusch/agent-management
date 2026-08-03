import { useCallback, useMemo, useRef, useState } from 'react'
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
  MoreHorizontal,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Inspector } from './components/Inspector'
import { Library } from './components/Library'
import { WorkflowEdge } from './components/WorkflowEdge'
import { WorkflowNode } from './components/WorkflowNode'
import { componentById, componentLibrary } from './data/library'
import type {
  ComponentTemplate,
  NodeStatus,
  ProjectContext,
  WorkflowDocument,
  WorkflowEdge as WorkflowEdgeType,
  WorkflowNode as WorkflowNodeType,
} from './types/workflow'

const nodeTypes = { workflow: WorkflowNode }
const edgeTypes = { workflow: WorkflowEdge }

const projectSeed: ProjectContext = {
  name: 'Acme storefront',
  root: './',
  branch: 'feature/product-grid',
  variables: {
    'project.instructions': 'AGENTS.md',
    'commands.check': 'pnpm typecheck && pnpm test',
    'commands.test': 'pnpm test',
    'preview.url': 'http://localhost:3000',
    'visual.tolerance': '4px spacing · AA contrast',
  },
}

function nodeFromTemplate(
  templateId: string,
  id: string,
  position: { x: number; y: number },
  description?: string,
): WorkflowNodeType {
  const template = componentById[templateId]
  if (!template) throw new Error(`Unknown component: ${templateId}`)
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
    },
  }
}

const initialNodes: WorkflowNodeType[] = [
  nodeFromTemplate('implement-ui', 'implement', { x: 40, y: 245 }, 'Build the new product grid from the approved brief.'),
  nodeFromTemplate('code-review', 'review', { x: 445, y: 72 }, 'Check correctness, maintainability, and project conventions.'),
  nodeFromTemplate('visual-judge', 'visual', { x: 445, y: 395 }, 'Compare desktop and mobile renders to the reference.'),
  nodeFromTemplate('decision-gate', 'gate', { x: 840, y: 235 }, 'Merge reviewer verdicts and choose the next route.'),
  nodeFromTemplate('summarize', 'ship', { x: 1225, y: 235 }, 'Prepare a pull request-ready handoff.'),
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
  edge('implement-review', 'implement', 'review', { data: { tone: 'success' } }),
  edge('implement-visual', 'implement', 'visual', { data: { tone: 'default' } }),
  edge('review-gate', 'review', 'gate', { data: { tone: 'success' } }),
  edge('visual-gate', 'visual', 'gate', { data: { tone: 'default' } }),
  edge('gate-ship', 'gate', 'ship', { data: { label: 'pass', tone: 'success', condition: 'route == ship' } }),
  edge('gate-loop', 'gate', 'implement', {
    sourceHandle: 'source-bottom',
    targetHandle: 'target-bottom',
    data: { label: 'revise', tone: 'danger', condition: 'route == revise' },
  }),
]

const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

function Workspace() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [project, setProject] = useState(projectSeed)
  const [workflowName, setWorkflowName] = useState('UI quality loop')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [running, setRunning] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [toast, setToast] = useState<string | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
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

  const setNodeStatus = useCallback((id: string, status: NodeStatus, result?: string) => {
    setNodes((current) => current.map((node) =>
      node.id === id
        ? {
            ...node,
            data: {
              ...node.data,
              status,
              result,
              runtime: status === 'passed' || status === 'failed' ? '2.9s' : undefined,
              tokens: status === 'passed' || status === 'failed' ? '2.4k tok' : undefined,
            },
          }
        : node,
    ))
  }, [setNodes])

  const addComponent = useCallback((template: ComponentTemplate, position?: { x: number; y: number }) => {
    const id = `${template.id}-${Date.now()}`
    const fallback = { x: 260 + Math.random() * 420, y: 180 + Math.random() * 260 }
    setNodes((current) => [...current, nodeFromTemplate(template.id, id, position ?? fallback)])
    setSelectedNodeId(id)
    setSaveState('saving')
  }, [setNodes])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({
      ...connection,
      id: `edge-${Date.now()}`,
      type: 'workflow',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      data: { tone: 'default' },
    }, current))
    setSaveState('saving')
  }, [setEdges])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const componentId = event.dataTransfer.getData('application/relay-component')
    const template = componentById[componentId]
    if (!template) return
    addComponent(template, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }, [addComponent, screenToFlowPosition])

  const documentForExport = useCallback((): WorkflowDocument => ({
    schemaVersion: '1.0',
    id: 'ui-quality-loop',
    name: workflowName,
    description: 'Implement, review in parallel, loop on quality failures, and prepare a handoff.',
    project,
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  }), [edges, nodes, project, workflowName])

  const saveWorkflow = useCallback(async () => {
    setSaveState('saving')
    localStorage.setItem('relay.workflow', JSON.stringify(documentForExport()))
    await sleep(350)
    setSaveState('saved')
    showToast('Workflow saved locally')
  }, [documentForExport, showToast])

  const exportWorkflow = useCallback(() => {
    const blob = new Blob([JSON.stringify(documentForExport(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.workflow.json`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('Workflow exported')
  }, [documentForExport, showToast, workflowName])

  const importWorkflow = useCallback(async (file: File) => {
    try {
      const imported = JSON.parse(await file.text()) as WorkflowDocument
      if (imported.schemaVersion !== '1.0' || !Array.isArray(imported.nodes) || !Array.isArray(imported.edges)) {
        throw new Error('Unsupported workflow document')
      }
      setNodes(imported.nodes)
      setEdges(imported.edges)
      setProject(imported.project)
      setWorkflowName(imported.name)
      setSelectedNodeId(null)
      window.setTimeout(() => fitView({ padding: 0.16, duration: 500 }), 50)
      showToast('Workflow imported')
    } catch {
      showToast('Could not import this workflow')
    }
  }, [fitView, setEdges, setNodes, showToast])

  const runWorkflow = useCallback(async () => {
    if (running) return
    setRunning(true)
    setNodes((current) => current.map((node) => ({
      ...node,
      data: { ...node.data, status: 'idle', result: undefined, runtime: undefined, tokens: undefined },
    })))

    setNodeStatus('implement', 'running', 'Editing 8 files…')
    await sleep(700)
    setNodeStatus('implement', 'passed', 'diff +468 −0 · 8 files')
    setNodeStatus('review', 'running', 'Reviewing patch…')
    setNodeStatus('visual', 'running', 'Checking 2 viewports…')
    await sleep(850)
    setNodeStatus('review', 'passed', '2 nits · non-blocking')
    setNodeStatus('visual', 'failed', 'H1 weight · padding mismatch')
    setNodeStatus('gate', 'running', 'Resolving verdicts…')
    await sleep(650)
    setNodeStatus('gate', 'failed', 'Route: revise')
    setNodeStatus('implement', 'running', 'Applying visual feedback…')
    await sleep(700)
    setNodeStatus('implement', 'passed', '2 visual fixes applied')
    setNodeStatus('visual', 'running', 'Rechecking viewports…')
    await sleep(650)
    setNodeStatus('visual', 'passed', 'Matches reference · AA')
    setNodeStatus('gate', 'passed', 'Route: ship')
    setNodeStatus('ship', 'running', 'Preparing handoff…')
    await sleep(650)
    setNodeStatus('ship', 'passed', 'PR summary ready')
    setRunning(false)
    showToast('Run completed after 1 revision')
  }, [running, setNodeStatus, setNodes, showToast])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>Relay</span>
          <em>alpha</em>
        </div>
        <div className="topbar-divider" />
        <button className="workspace-switcher">
          <FolderGit2 size={15} />
          {project.name}
          <ChevronDown size={14} />
        </button>
        <div className="topbar-actions">
          <button className="subtle-button" onClick={() => importInput.current?.click()}>
            <Import size={15} /> Import
          </button>
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
          <button className="subtle-button" onClick={exportWorkflow}><Download size={15} /> Export</button>
          <button className="save-button" onClick={() => void saveWorkflow()}>
            {saveState === 'saved' ? <Check size={15} /> : <Cloud className="pulse" size={15} />}
            {saveState === 'saved' ? 'Saved' : 'Save'}
          </button>
          <button className="icon-button"><MoreHorizontal size={18} /></button>
        </div>
      </header>

      <div className="workspace-body">
        {libraryOpen ? (
          <Library components={componentLibrary} onAdd={addComponent} onCollapse={() => setLibraryOpen(false)} />
        ) : (
          <button className="open-library" onClick={() => setLibraryOpen(true)} aria-label="Open component library">
            <Menu size={17} />
          </button>
        )}

        <section className="canvas-shell">
          <div className="canvas-toolbar">
            <div className="workflow-name">
              <span className="workflow-glyph"><GitFlowIcon /></span>
              <div>
                <span className="eyebrow">Workflow</span>
                <input value={workflowName} onChange={(event) => { setWorkflowName(event.target.value); setSaveState('saving') }} />
              </div>
            </div>
            <div className="toolbar-actions">
              <button className="subtle-button"><LayoutTemplate size={15} /> Templates</button>
              <button className="subtle-button"><Plus size={15} /> Variable</button>
              <button className="run-button" disabled={running} onClick={() => void runWorkflow()}>
                <Play size={14} fill="currentColor" /> {running ? 'Running…' : 'Run workflow'}
              </button>
            </div>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={(changes) => { onNodesChange(changes); setSaveState('saving') }}
            onEdgesChange={(changes) => { onEdgesChange(changes); setSaveState('saving') }}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
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
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#252a31" />
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(node) => `var(--${String(node.data?.color ?? 'mint')})`}
              maskColor="rgba(7, 9, 12, .76)"
            />
          </ReactFlow>

          <div className="canvas-tip"><Box size={14} /> Drag components onto the canvas · connect handles to define flow</div>
        </section>

        <Inspector
          node={selectedNode}
          project={project}
          onClose={() => setSelectedNodeId(null)}
          onUpdateNode={updateNode}
          onUpdateProject={(nextProject) => { setProject(nextProject); setSaveState('saving') }}
        />
      </div>
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </main>
  )
}

function GitFlowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v10a4 4 0 0 0 4 4h8M6 10h7a4 4 0 0 0 4-4V4M4 4h4M16 2v4h4M16 16v4h4" /></svg>
}

export default function App() {
  return <ReactFlowProvider><Workspace /></ReactFlowProvider>
}
