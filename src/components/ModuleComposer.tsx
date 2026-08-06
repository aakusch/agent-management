import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from '@xyflow/react'
import {
  AlertCircle,
  ArrowLeft,
  Box,
  Check,
  Layers3,
  LogIn,
  Menu,
  Moon,
  Sun,
} from 'lucide-react'
import { Inspector } from './Inspector'
import { Library } from './Library'
import { TransitionInspector } from './TransitionInspector'
import { WorkflowEdge } from './WorkflowEdge'
import { WorkflowNode } from './WorkflowNode'
import { WorkflowToolbar } from './WorkflowToolbar'
import { componentColors } from '../lib/componentIcons'
import { DEFAULT_HANDOFF, edge, nextUnroutedOutcome, nodeFromTemplate, normalizeEdgeData, snapGrid } from '../lib/graph'
import { useToast } from '../lib/hooks'
import { instanceId, uniqueId } from '../lib/ids'
import type {
  ComponentTemplate,
  ProjectContext,
  WorkflowEdge as WorkflowEdgeType,
  WorkflowModuleDefinition,
  WorkflowNode as WorkflowNodeType,
} from '../types/workflow'

const nodeTypes = { workflow: WorkflowNode }
const edgeTypes = { workflow: WorkflowEdge }

interface ModuleComposerProps {
  module: WorkflowModuleDefinition | null
  modules: WorkflowModuleDefinition[]
  components: ComponentTemplate[]
  project: ProjectContext
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onSave: (module: WorkflowModuleDefinition) => void
  onExit: () => void
  onNewComponent: () => void
}

const bumpVersion = (version: string) => {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return version
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
}

export function ModuleComposer({ module, modules, components, project, theme, onToggleTheme, onSave, onExit, onNewComponent }: ModuleComposerProps) {
  // Why: a module is the composition primitive. Nesting modules inside modules would make the
  // saved contract depend on another module's version, so only plain components are authorable here.
  const authoringComponents = useMemo(
    () => components.filter((item) => item.kind !== 'catalyst' && item.kind !== 'module'),
    [components],
  )
  const componentLookup = useMemo(
    () => Object.fromEntries(authoringComponents.map((item) => [item.id, item])),
    [authoringComponents],
  )

  const [startingGraph] = useState(() => {
    if (!module) return { nodes: [] as WorkflowNodeType[], edges: [] as WorkflowEdgeType[] }
    const lookup = Object.fromEntries(authoringComponents.map((item) => [item.id, item]))
    const nodes = module.nodes.reduce<WorkflowNodeType[]>((result, spec) => {
      const template = lookup[spec.componentId]
      if (template) result.push(nodeFromTemplate(template, spec.id, spec.position, spec.description))
      return result
    }, [])
    const present = new Set(nodes.map((node) => node.id))
    const edges = module.edges
      .filter((item) => present.has(item.source) && present.has(item.target))
      .map((item) => edge(item.id, item.source, item.target, { data: normalizeEdgeData(item.data) }))
    return { nodes, edges }
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(startingGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(startingGraph.edges)
  const [name, setName] = useState(module?.name ?? 'New module')
  const [description, setDescription] = useState(module?.description ?? '')
  const [color, setColor] = useState(module?.color ?? 'cyan')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [minimapVisible, setMinimapVisible] = useState(true)
  const { toast, showToast } = useToast()
  const { screenToFlowPosition, fitView } = useReactFlow()

  const missingComponents = module ? module.nodes.length - startingGraph.nodes.length : 0
  useEffect(() => {
    if (missingComponents > 0) showToast(`${missingComponents} component${missingComponents === 1 ? '' : 's'} in this module are not available in the workspace and were left out.`, 'error')
  }, [missingComponents, showToast])

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId])
  const selectedEdge = useMemo(() => edges.find((item) => item.id === selectedEdgeId) ?? null, [edges, selectedEdgeId])
  const selectedEdgeSource = useMemo(() => nodes.find((node) => node.id === selectedEdge?.source), [nodes, selectedEdge])
  const selectedEdgeTarget = useMemo(() => nodes.find((node) => node.id === selectedEdge?.target), [nodes, selectedEdge])

  const entryNodes = useMemo(() => nodes.filter((node) => !edges.some((item) => item.target === node.id)), [edges, nodes])
  const exitNodes = useMemo(() => nodes.filter((node) => !edges.some((item) => item.source === node.id)), [edges, nodes])

  // Why: a new module's id comes from its name, so it has to skip ids already in the library —
  // reusing one silently replaced that module, and with it every workflow step linked to it.
  const savedId = useMemo(
    () => module?.id ?? uniqueId(name, (candidate) => modules.some((item) => item.id === candidate), 'module'),
    [module?.id, modules, name],
  )

  const addComponent = useCallback((template: ComponentTemplate, position?: { x: number; y: number }) => {
    const id = instanceId(template.id)
    const fallback = { x: 260 + Math.random() * 420, y: 180 + Math.random() * 260 }
    setNodes((current) => [...current, nodeFromTemplate(template, id, position ?? fallback)])
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }, [setNodes])

  const updateNode = useCallback((id: string, patch: Partial<WorkflowNodeType['data']>) => {
    setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node))
  }, [setNodes])

  const updateEdge = useCallback((id: string, patch: Partial<WorkflowEdgeType['data']>) => {
    setEdges((current) => current.map((item) => item.id === id ? { ...item, data: { ...(item.data ?? {}), ...patch } } : item))
  }, [setEdges])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({
      ...connection,
      id: instanceId('edge'),
      type: 'workflow',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      data: { tone: 'default', when: nextUnroutedOutcome(nodes.find((node) => node.id === connection.source), current), handoff: DEFAULT_HANDOFF },
    }, current))
  }, [nodes, setEdges])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const template = componentLookup[event.dataTransfer.getData('application/relay-component')]
    if (!template) return
    addComponent(template, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }, [addComponent, componentLookup, screenToFlowPosition])

  const validate = useCallback(() => {
    if (!nodes.length) {
      showToast('Add at least one component to this module.', 'error')
      return false
    }
    const nodeIds = new Set(nodes.map((node) => node.id))
    const broken = edges.find((item) => !nodeIds.has(item.source) || !nodeIds.has(item.target))
    if (broken) {
      showToast(`Transition ${broken.id} references a missing component.`, 'error')
      return false
    }
    if (nodes.length > 1 && entryNodes.length === nodes.length) {
      showToast('Connect the components so the module describes one flow.', 'error')
      return false
    }
    showToast(`Module valid · ${nodes.length} components · ${entryNodes.length} entry · ${exitNodes.length} exit`)
    return true
  }, [edges, entryNodes.length, exitNodes.length, nodes, showToast])

  const save = useCallback(() => {
    if (!name.trim()) {
      showToast('Name the module before saving.', 'error')
      return
    }
    if (!nodes.length) {
      showToast('Add at least one component before saving.', 'error')
      return
    }
    const nodeIds = new Set(nodes.map((node) => node.id))
    if (edges.some((item) => !nodeIds.has(item.source) || !nodeIds.has(item.target))) {
      showToast('Remove transitions that reference missing components.', 'error')
      return
    }
    const minX = Math.min(...nodes.map((node) => node.position.x))
    const minY = Math.min(...nodes.map((node) => node.position.y))
    onSave({
      id: savedId,
      name: name.trim(),
      description: description.trim() || 'Reusable workflow module.',
      version: module ? bumpVersion(module.version) : '0.1.0',
      icon: module?.icon ?? 'layers',
      color,
      tags: module?.tags ?? ['custom', 'module'],
      source: 'user',
      createdAt: module?.createdAt ?? new Date().toISOString(),
      nodes: nodes.map((node) => ({
        id: node.id,
        componentId: node.data.templateId,
        position: { x: Math.round(node.position.x - minX), y: Math.round(node.position.y - minY) },
        description: node.data.description,
      })),
      edges: edges.map((item) => ({ id: item.id, source: item.source, target: item.target, data: item.data })),
      entryNodeIds: entryNodes.map((node) => node.id),
      exitNodeIds: exitNodes.map((node) => node.id),
    })
  }, [color, description, edges, entryNodes, exitNodes, module, name, nodes, onSave, savedId, showToast])

  return (
    <main className="app-shell module-composer-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={onExit}>
          <span className="brand-mark"><Layers3 size={17} /></span>
          <span>Relay</span>
          <em>module</em>
        </button>
        <div className="topbar-divider" />
        <button className="workspace-switcher" onClick={onExit}><ArrowLeft size={15} /> Components</button>
        <div className="topbar-divider" />
        <div className="topbar-workflow-name">
          <span className={`workflow-glyph module-glyph tone-${color}`}><Layers3 size={15} /></span>
          <div>
            <span className="eyebrow">{module ? `Module · v${module.version}` : 'New module'}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Module name" />
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button className="run-button" onClick={save}><Layers3 size={14} /> Save module</button>
        </div>
      </header>

      <div className="workspace-body">
        {libraryOpen ? (
          <Library components={authoringComponents} onAdd={addComponent} onCollapse={() => setLibraryOpen(false)} onNewComponent={onNewComponent} variant="module" />
        ) : (
          <button className="open-library" onClick={() => setLibraryOpen(true)} aria-label="Open component library"><Menu size={17} /></button>
        )}

        <section className="canvas-shell">
          <div className={`module-scope-strip tone-${color}`}>
            <span><Layers3 size={14} /></span>
            <div><strong>Module composition</strong><small>Compose components into one reusable step. Project paths and run objectives stay outside the module.</small></div>
            <em>{nodes.length} components</em>
          </div>
          <WorkflowToolbar
            minimapVisible={minimapVisible}
            onFitView={() => void fitView({ padding: 0.17, duration: 450 })}
            onValidate={validate}
            onToggleMinimap={() => setMinimapVisible((visible) => !visible)}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null) }}
            onEdgeClick={(_, selected) => { setSelectedEdgeId(selected.id); setSelectedNodeId(null) }}
            onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null) }}
            onDrop={onDrop}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
            snapToGrid
            snapGrid={snapGrid}
            fitView
            fitViewOptions={{ padding: 0.2 }}
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
          {!nodes.length && <div className="module-canvas-empty"><Layers3 size={22} /><strong>Nothing in this module yet</strong><span>Add components from the library, connect them, then save the composition as a module.</span></div>}
          <div className="canvas-tip"><Box size={14} /> Components inside a module keep their transitions, loops, and handoffs</div>
        </section>

        {selectedNode ? (
          <Inspector
            node={selectedNode}
            project={project}
            sourceInstruction={componentLookup[selectedNode.data.templateId]?.instruction ?? selectedNode.data.instruction}
            catalysts={[]}
            workflowId={module?.id ?? 'new-module'}
            onClose={() => setSelectedNodeId(null)}
            onUpdateNode={updateNode}
            onOpenProjectConfig={onExit}
            onOpenCatalysts={onExit}
            onToggleCatalyst={() => undefined}
            onBindCatalyst={() => undefined}
            modules={modules}
            incomingCount={edges.filter((item) => item.target === selectedNode.id).length}
            onExpandModule={() => showToast('Nested modules stay linked inside a module composition.', 'error')}
          />
        ) : selectedEdge ? (
          <TransitionInspector
            edge={selectedEdge}
            sourceNode={selectedEdgeSource}
            targetNode={selectedEdgeTarget}
            onClose={() => setSelectedEdgeId(null)}
            onUpdateEdge={updateEdge}
          />
        ) : (
          <aside className="inspector-panel module-contract-panel">
            <div className="inspector-heading">
              <div className="inspector-component-title">
                <span className={`inspector-kind tone-${color}`}><Layers3 size={15} /></span>
                <div><span className="eyebrow">Public contract</span><h2>Module details</h2></div>
              </div>
            </div>
            <div className="inspector-scroll">
              <section className="form-section inspector-section-card">
                <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label><span>What reusable job does it complete?</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Run typecheck, lint, tests, and build so each failure can be routed precisely." /></label>
                <div className="module-accent-field"><span>Accent</span><div className="color-picker">{componentColors.map((option) => <button key={option} className={`tone-${option} ${color === option ? 'selected' : ''}`} onClick={() => setColor(option)} aria-label={`${option} accent`}><i /></button>)}</div></div>
              </section>

              <section className="inspector-section-card module-boundary-summary">
                <div className="inspector-section-heading"><span><LogIn size={14} /></span><div><h3>Boundary</h3><p>Derived from the graph: entry steps receive the handoff, exit steps produce the result.</p></div></div>
                <div className="module-boundary-grid">
                  <div><span>Components</span><strong>{nodes.length}</strong></div>
                  <div><span>Transitions</span><strong>{edges.length}</strong></div>
                  <div><span>Entry points</span><strong>{entryNodes.length || 'None'}</strong></div>
                  <div><span>Exit points</span><strong>{exitNodes.length || 'None'}</strong></div>
                </div>
                <ol className="module-boundary-list">{nodes.map((node, index) => <li key={node.id}><span>{index + 1}</span><div><strong>{node.data.label}</strong><small>{entryNodes.some((item) => item.id === node.id) ? 'entry' : exitNodes.some((item) => item.id === node.id) ? 'exit' : 'internal'}</small></div></li>)}</ol>
              </section>
              <div className="module-save-hint"><Layers3 size={14} /><p>Saving writes <code>modules/{savedId}.json</code> and updates every workflow that links this module.</p></div>
            </div>
          </aside>
        )}
      </div>
      {toast && <div className={`toast ${toast.tone}`} role="status" aria-live="polite">
        {toast.tone === 'error' ? <AlertCircle size={15} /> : <Check size={15} />} {toast.message}
      </div>}
    </main>
  )
}
