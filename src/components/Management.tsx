import { useEffect, useRef, useState } from 'react'
import {
  Accessibility,
  Activity,
  ArrowRight,
  Blocks,
  Bot,
  Bug,
  Cable,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  CircleUserRound,
  Clock3,
  Cpu,
  FileCode2,
  FileCheck2,
  FolderGit2,
  GitFork,
  GitBranch,
  Globe2,
  HardDrive,
  Eye,
  Layers3,
  KeyRound,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  TerminalSquare,
  Trash2,
  Webhook,
  Zap,
  WandSparkles,
  Workflow,
  Wrench,
  X,
} from 'lucide-react'
import type { ComponentKind, ComponentTemplate, ProjectCapability, ProjectContext, ReasoningEffort, RelayTool, WorkflowModuleDefinition } from '../types/workflow'
import type { CatalystDefinition, CatalystKind, PendingRun, RunMonitorBoard, WorkflowRecord, WorkflowTemplate } from '../types/catalog'
import { RunBoard } from './RunBoard'
import { StartRunModal, type RunConfiguration } from './StartRunModal'
import { describeCatalyst } from '../lib/catalysts'

export type AppPage = 'dashboard' | 'builder' | 'workflows' | 'components' | 'projects' | 'templates' | 'catalysts' | 'runs'

interface ManagementProps {
  page: Exclude<AppPage, 'builder'>
  onNavigate: (page: AppPage) => void
  project: ProjectContext
  onUpdateProject: (project: ProjectContext) => void
  components: ComponentTemplate[]
  modules: WorkflowModuleDefinition[]
  onCreateComponent: (component: ComponentTemplate) => void
  onCreateModule: (module: WorkflowModuleDefinition) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  workflows: WorkflowRecord[]
  templates: WorkflowTemplate[]
  onCreateTemplate: (template: WorkflowTemplate) => void
  onToggleTemplatePublished: (id: string) => void
  onUseTemplate: (template: WorkflowTemplate) => void
  onStageWorkflow: (workflow: WorkflowRecord, configuration: RunConfiguration) => void
  stagedRuns: PendingRun[]
  onUpdateStagedRuns: (runs: PendingRun[]) => void
  monitorBoard: RunMonitorBoard
  onUpdateMonitorBoard: (board: RunMonitorBoard) => void
  catalysts: CatalystDefinition[]
  onCreateCatalyst: (catalyst: CatalystDefinition) => void
  onToggleCatalyst: (id: string) => void
}

const pageLabels: Record<Exclude<AppPage, 'builder'>, string> = {
  dashboard: 'Dashboard',
  workflows: 'Workflows',
  components: 'Components',
  projects: 'Configure',
  templates: 'Templates',
  catalysts: 'Catalysts',
  runs: 'Runs',
}

const navSections = [
  { label: 'Build', items: [
    { id: 'components', label: 'Components', icon: Blocks },
    { id: 'workflows', label: 'Workflows', icon: Workflow },
  ] },
  { label: 'Setup', items: [
    { id: 'projects', label: 'Configure', icon: Settings2 },
    { id: 'templates', label: 'Templates', icon: Layers3 },
  ] },
  { label: 'Operations', items: [
    { id: 'runs', label: 'Runs', icon: Activity },
  ] },
] as const

const componentIconOptions = [
  { id: 'wand', label: 'Builder', Icon: WandSparkles },
  { id: 'bot', label: 'Agent', Icon: Bot },
  { id: 'scan', label: 'Review', Icon: ScanSearch },
  { id: 'eye', label: 'Visual', Icon: Eye },
  { id: 'terminal', label: 'Terminal', Icon: TerminalSquare },
  { id: 'split', label: 'Router', Icon: GitFork },
  { id: 'shield', label: 'Safety', Icon: ShieldCheck },
  { id: 'user-check', label: 'Human', Icon: CircleUserRound },
  { id: 'accessibility', label: 'Access', Icon: Accessibility },
  { id: 'bug', label: 'Debug', Icon: Bug },
  { id: 'file-check', label: 'Handoff', Icon: FileCheck2 },
  { id: 'workflow', label: 'Flow', Icon: Workflow },
  { id: 'layers', label: 'Module', Icon: Layers3 },
  { id: 'zap', label: 'Catalyst', Icon: Zap },
] as const

const componentColors = ['mint', 'blue', 'violet', 'amber', 'coral', 'rose', 'cyan'] as const
const projectTools: { id: RelayTool; label: string; detail: string }[] = [
  { id: 'filesystem', label: 'Files', detail: 'Read and edit within the project.' },
  { id: 'terminal', label: 'Terminal', detail: 'Run approved project commands.' },
  { id: 'git', label: 'Git', detail: 'Inspect diffs, branches, and history.' },
  { id: 'browser', label: 'Browser', detail: 'Test local interfaces and flows.' },
  { id: 'web', label: 'Web', detail: 'Access permitted external sources.' },
]

function ComponentIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  const Icon = componentIconOptions.find((item) => item.id === icon)?.Icon ?? Bot
  return <Icon size={size} strokeWidth={1.8} />
}

export function Management({
  page,
  onNavigate,
  project,
  onUpdateProject,
  components,
  modules,
  onCreateComponent,
  onCreateModule,
  theme,
  onToggleTheme,
  workflows,
  templates,
  onCreateTemplate,
  onToggleTemplatePublished,
  onUseTemplate,
  onStageWorkflow,
  stagedRuns,
  onUpdateStagedRuns,
  monitorBoard,
  onUpdateMonitorBoard,
  catalysts,
  onCreateCatalyst,
  onToggleCatalyst,
}: ManagementProps) {
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!overflowOpen) return
    const close = (event: PointerEvent) => {
      if (!overflowRef.current?.contains(event.target as Node)) setOverflowOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOverflowOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [overflowOpen])

  return (
    <main className="app-shell management-shell">
      <header className="topbar management-topbar">
        <button className="brand brand-button" onClick={() => onNavigate('dashboard')}>
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>Relay</span>
          <em>alpha</em>
        </button>
        <div className="topbar-divider" />
        <span className="topbar-page">{pageLabels[page]}</span>
        <div className="topbar-actions">
          <button className="run-button" onClick={() => onNavigate('builder')}><Plus size={14} /> Open builder</button>
          <div className="overflow-wrap" ref={overflowRef}>
            <button className="icon-button" onClick={() => setOverflowOpen((open) => !open)} aria-label="More application actions" aria-expanded={overflowOpen}><MoreHorizontal size={18} /></button>
            {overflowOpen && <div className="overflow-menu" role="menu">
              <button role="menuitem" onClick={() => { onToggleTheme(); setOverflowOpen(false) }}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}<span><strong>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</strong><small>Change the interface appearance</small></span></button>
            </div>}
          </div>
        </div>
      </header>
      <div className="management-body">
        <aside className="management-nav">
          <nav>
            {navSections.map((section) => <section className="management-nav-section" key={section.label}>
              <h2>{section.label}</h2>
              {section.items.map((item) => {
                const Icon = item.icon
                return <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}><Icon size={16} /> {item.label}</button>
              })}
            </section>)}
          </nav>
          <div className="nav-help">
            <ShieldCheck size={17} />
            <strong>Safe by default</strong>
            <span>Every loop, tool, and publish action has an explicit limit or permission.</span>
          </div>
        </aside>
        <section className="management-content">
          {page === 'dashboard' && <Dashboard onNavigate={onNavigate} project={project} components={components} workflows={workflows} />}
          {page === 'workflows' && <WorkflowsPage onNavigate={onNavigate} workflows={workflows} projectName={project.name} onStageWorkflow={onStageWorkflow} />}
          {page === 'components' && <ComponentsPage components={components} modules={modules} onCreate={onCreateComponent} onCreateModule={onCreateModule} catalysts={catalysts} workflows={workflows} onCreateCatalyst={onCreateCatalyst} onToggleCatalyst={onToggleCatalyst} />}
          {page === 'projects' && <ProjectsPage project={project} onUpdate={onUpdateProject} />}
          {page === 'templates' && <TemplatesPage templates={templates} modules={modules} onCreate={onCreateTemplate} onTogglePublished={onToggleTemplatePublished} onUseTemplate={onUseTemplate} />}
          {page === 'catalysts' && <CatalystsPage catalysts={catalysts} workflows={workflows} onCreate={onCreateCatalyst} onToggle={onToggleCatalyst} />}
          {page === 'runs' && <RunsPage onNavigate={onNavigate} stagedRuns={stagedRuns} onUpdateStagedRuns={onUpdateStagedRuns} workflows={workflows} board={monitorBoard} onUpdateBoard={onUpdateMonitorBoard} catalysts={catalysts} />}
        </section>
      </div>
    </main>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function Dashboard({ onNavigate, project, components, workflows }: { onNavigate: (page: AppPage) => void; project: ProjectContext; components: ComponentTemplate[]; workflows: WorkflowRecord[] }) {
  const projectConnected = Boolean(project.root)
  return (
    <div className="page-wrap">
      <PageHeading
        eyebrow="Good morning"
        title="Build reliable work, visually."
        description="Start with a proven workflow, adjust it for your project, then hand one complete assignment to your agent."
        action={<button className="primary-cta" onClick={() => onNavigate('builder')}><Plus size={16} /> Create workflow</button>}
      />

      <div className="metrics-grid metrics-grid-three">
        <Metric label="Workflows" value={String(workflows.length)} detail="Saved in this workspace" icon={Workflow} />
        <Metric label="Components" value={String(components.length)} detail="Markdown definitions available" icon={Blocks} />
        <Metric label="Connected projects" value={projectConnected ? '1' : '0'} detail={projectConnected ? project.name : 'Connect a local repository'} icon={FolderGit2} />
      </div>

      <section className="surface dashboard-workflows">
        <div className="surface-heading"><div><span className="eyebrow">Workspace</span><h2>All workflows</h2></div><button className="text-button" onClick={() => onNavigate('workflows')}>Manage workflows <ArrowRight size={13} /></button></div>
        <WorkflowRows workflows={workflows} onOpen={() => onNavigate('builder')} />
      </section>

      {!projectConnected && <section className="surface getting-started-card dashboard-setup">
        <div className="surface-heading"><div><span className="eyebrow">Before the first run</span><h2>Connect the workflow to a project</h2></div></div>
        <div className="setup-steps">
          <SetupStep number="1" title="Connect a local repository" detail="Set the root, branch, commands, and project variables" onClick={() => onNavigate('projects')} />
          <SetupStep number="2" title="Review reusable instructions" detail="Inspect exactly what each configured agent receives" onClick={() => onNavigate('components')} />
          <SetupStep number="3" title="Start with an objective" detail="Send a kickoff prompt and run policy to the local driver" onClick={() => onNavigate('builder')} />
        </div>
      </section>}
    </div>
  )
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: React.ComponentType<{ size?: number }>; }) {
  return <div className="metric-card"><span><Icon size={16} /></span><strong>{value}</strong><h3>{label}</h3><p>{detail}</p></div>
}

function SetupStep({ done, number, title, detail, onClick }: { done?: boolean; number: string; title: string; detail: string; onClick: () => void }) {
  return <button className="setup-step" onClick={onClick}><span className={done ? 'done' : ''}>{done ? <CheckCircle2 size={16} /> : number}</span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight size={16} /></button>
}

function WorkflowRows({ workflows, onOpen, onStage }: { workflows: WorkflowRecord[]; onOpen: (workflow: WorkflowRecord) => void; onStage?: (workflow: WorkflowRecord) => void }) {
  if (workflows.length === 0) return <div className="table-empty"><Workflow size={20} /><strong>No workflows yet</strong><span>Create one in the builder or start from a template.</span></div>
  return <div className="workflow-rows">{workflows.map((workflow) => <div className={`workflow-row-shell ${onStage ? 'has-stage-action' : ''}`} key={workflow.id}>
    <button className="workflow-row" onClick={() => onOpen(workflow)}>
      <span className="row-icon"><Workflow size={17} /></span><div className="row-main"><strong>{workflow.name}</strong><small>{workflow.description}</small></div><span>{workflow.nodeCount} steps</span><span>{workflow.projectName ?? 'Any project'}</span><span className={`status-chip ${workflow.status}`}>{workflow.status}</span><ChevronRight size={15} />
    </button>
    {onStage && <button className="workflow-stage-action" onClick={() => onStage(workflow)} disabled={workflow.entryMode === 'catalyst'} title={workflow.entryMode === 'catalyst' ? 'Catalyst workflows are staged from the builder.' : `Stage ${workflow.name}`}><Play size={13} /> {workflow.entryMode === 'catalyst' ? 'Catalyst' : 'Stage'}</button>}
  </div>)}</div>
}

function WorkflowsPage({ onNavigate, workflows, projectName, onStageWorkflow }: { onNavigate: (page: AppPage) => void; workflows: WorkflowRecord[]; projectName: string; onStageWorkflow: (workflow: WorkflowRecord, configuration: RunConfiguration) => void }) {
  const [query, setQuery] = useState('')
  const [stagingWorkflow, setStagingWorkflow] = useState<WorkflowRecord | null>(null)
  const visibleWorkflows = workflows.filter((workflow) => `${workflow.name} ${workflow.description} ${workflow.projectName ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <div className="page-wrap"><PageHeading eyebrow="Library" title="Workflows" description="Saved ways of working. Stage one with an objective, or open it to customize the graph." action={<button className="primary-cta" onClick={() => onNavigate('builder')}><Plus size={16} /> New workflow</button>} />
      <div className="filter-row"><label className="wide-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows" /></label><button className="filter-button" onClick={() => setQuery('')}>All projects <ChevronRight size={13} /></button></div>
      <div className="workflow-table surface">
        <WorkflowRows workflows={visibleWorkflows} onOpen={() => onNavigate('builder')} onStage={setStagingWorkflow} />
      </div>
    </div>
    {stagingWorkflow && <StartRunModal workflowName={stagingWorkflow.name} projectName={stagingWorkflow.projectName ?? projectName} onClose={() => setStagingWorkflow(null)} onStart={(configuration) => { onStageWorkflow(stagingWorkflow, configuration); setStagingWorkflow(null) }} />}
  </>
}

function ComponentsPage({ components, modules, onCreate, onCreateModule, catalysts, workflows, onCreateCatalyst, onToggleCatalyst }: { components: ComponentTemplate[]; modules: WorkflowModuleDefinition[]; onCreate: (component: ComponentTemplate) => void; onCreateModule: (module: WorkflowModuleDefinition) => void; catalysts: CatalystDefinition[]; workflows: WorkflowRecord[]; onCreateCatalyst: (catalyst: CatalystDefinition) => void; onToggleCatalyst: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState(components[0]?.id ?? '')
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const selected = components.find((item) => item.id === selectedId) ?? components[0]
  const selectedModule = modules.find((item) => item.id === selectedModuleId)
  const visibleComponents = components.filter((component) => `${component.name} ${component.description} ${component.kind}`.toLowerCase().includes(query.toLowerCase()))
  const [draft, setDraft] = useState({ name: '', description: '', kind: 'agent' as ComponentKind, icon: 'wand', color: 'mint', instruction: '', inputs: '', outputs: '' })
  const [instruction, setInstruction] = useState(selected?.instruction ?? '')
  const [moduleDraft, setModuleDraft] = useState({ name: '', description: '', inputs: '', outputs: '' })

  useEffect(() => { setInstruction(selected?.instruction ?? '') }, [selected?.id, selected?.instruction])
  useEffect(() => { setModuleDraft({ name: selectedModule?.name ?? '', description: selectedModule?.description ?? '', inputs: selectedModule?.inputs.join(', ') ?? '', outputs: selectedModule?.outputs.join(', ') ?? '' }) }, [selectedModule?.id, selectedModule?.name, selectedModule?.description, selectedModule?.inputs, selectedModule?.outputs])

  const create = () => {
    if (!draft.name.trim() || !draft.instruction.trim()) return
    const id = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    onCreate({ id, name: draft.name, description: draft.description || 'Custom workspace component.', kind: draft.kind, icon: draft.icon, color: draft.color, version: '0.1.0', tags: ['custom'], inputs: draft.inputs.split(',').map((value) => value.trim()).filter(Boolean), outputs: draft.outputs.split(',').map((value) => value.trim()).filter(Boolean), instruction: draft.instruction })
    setSelectedId(id)
    setSelectedModuleId(null)
    setCreating(false)
    setDraft({ name: '', description: '', kind: 'agent', icon: 'wand', color: 'mint', instruction: '', inputs: '', outputs: '' })
  }

  const customize = () => {
    if (!selected) return
    const customized = { ...selected, id: `${selected.id}-custom`, name: `${selected.name} custom`, version: '0.1.0', tags: [...selected.tags, 'custom'], instruction }
    onCreate(customized)
    setSelectedId(customized.id)
    setSelectedModuleId(null)
  }
  const saveComponent = () => {
    if (!selected) return
    onCreate({ ...selected, instruction })
  }
  const customizeModule = () => {
    if (!selectedModule) return
    const customized = { ...selectedModule, id: `${selectedModule.id}-custom`, name: `${selectedModule.name} custom`, version: '0.1.0', source: 'user' as const, tags: [...selectedModule.tags, 'custom'], createdAt: new Date().toISOString() }
    onCreateModule(customized)
    setSelectedModuleId(customized.id)
  }
  const saveModule = () => {
    if (!selectedModule) return
    onCreateModule({ ...selectedModule, name: moduleDraft.name.trim() || selectedModule.name, description: moduleDraft.description.trim() || selectedModule.description, inputs: moduleDraft.inputs.split(',').map((value) => value.trim()).filter(Boolean), outputs: moduleDraft.outputs.split(',').map((value) => value.trim()).filter(Boolean) })
  }
  const revealEditor = () => window.requestAnimationFrame(() => document.getElementById('asset-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  const openComponent = (id: string) => { setSelectedId(id); setSelectedModuleId(null); setCreating(false); revealEditor() }
  const openModule = (id: string) => { setSelectedModuleId(id); setCreating(false); revealEditor() }

  return <div className="page-wrap"><PageHeading eyebrow="Building blocks" title="Components, modules & catalysts" description="Components do one job. Modules package a reusable graph. Catalysts are secure platform entrypoints." action={<button className="primary-cta" onClick={() => { setCreating(true); setSelectedModuleId(null) }}><Plus size={16} /> New component</button>} />
    <section className="asset-catalog-section">
      <div className="surface-heading"><div><span className="eyebrow">Atomic instructions</span><h2>Components</h2><p>Select a component to inspect its contract or create an editable local version.</p></div><span className="module-count">{components.length} available</span></div>
      <label className="wide-search asset-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components" /></label>
      <div className="component-catalog-grid">{visibleComponents.map((component) => <button className={`surface component-catalog-card tone-${component.color} ${selected?.id === component.id && !selectedModule ? 'selected' : ''}`} key={component.id} onClick={() => openComponent(component.id)}><span className={`component-kind-dot tone-${component.color}`}><ComponentIcon icon={component.icon} /></span><div><div className="module-card-heading"><strong>{component.name}</strong><span>{component.tags.includes('custom') ? 'Yours' : 'Relay'}</span></div><p>{component.description}</p><div className="module-card-contract"><span>{component.kind}</span><i /><span>{component.inputs.length} in</span><i /><span>{component.outputs.length} out</span></div></div><ChevronRight size={15} /></button>)}</div>
    </section>
    <section className="module-catalog-section">
      <div className="surface-heading"><div><span className="eyebrow">Reusable compositions</span><h2>Modules</h2><p>Linked compositions with a visible internal shape. Select one to inspect its public contract and contained work.</p></div><span className="module-count">{modules.length} available</span></div>
      <div className="module-catalog-grid">{modules.map((module) => <button className={`surface module-catalog-card tone-${module.color} ${selectedModule?.id === module.id ? 'selected' : ''}`} key={module.id} onClick={() => openModule(module.id)}><span className={`module-card-icon tone-${module.color}`}><Layers3 size={16} /></span><div><div className="module-card-heading"><strong>{module.name}</strong><span>{module.source === 'built-in' ? 'Relay' : 'Yours'}</span></div><p>{module.description}</p><div className="module-composition" aria-label={`${module.nodes.length} components in ${module.name}`}>{module.nodes.slice(0, 5).map((node, index) => <i key={node.id} style={{ '--module-index': index } as React.CSSProperties} />)}</div><div className="module-card-contract"><span>{module.nodes.length} components</span><i /><span>{module.inputs.length} in</span><i /><span>{module.outputs.length} out</span></div></div><ChevronRight size={15} /></button>)}</div>
    </section>
    <div className="component-manager surface" id="asset-editor">
      <div className="component-editor-pane">
        {creating ? <>
          <div className="component-create-heading"><div><span className="eyebrow">New reusable instruction</span><h2>Create a component</h2><p>Give the agent one clear job. You can specialize it per workflow later.</p></div><button className="icon-button" onClick={() => setCreating(false)} aria-label="Close component creator"><X size={17} /></button></div>
          <div className="component-create-layout">
            <div className="component-create-form">
              <section className="create-section">
                <div className="create-section-heading"><span>1</span><div><strong>Identity</strong><small>How users recognize this component on the board.</small></div></div>
                <div className="editor-form"><label><span>Name</span><input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Accessibility reviewer" /></label><label><span>What does it do?</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Checks an interface for accessibility issues." /></label></div>
                <div className="icon-picker-label">Icon</div>
                <div className="icon-picker">{componentIconOptions.map(({ id, label, Icon }) => <button key={id} className={draft.icon === id ? 'selected' : ''} onClick={() => setDraft({ ...draft, icon: id })} title={label} aria-label={`${label} icon`}><Icon size={17} /></button>)}</div>
                <div className="color-picker-label">Accent</div>
                <div className="color-picker">{componentColors.map((color) => <button key={color} className={`tone-${color} ${draft.color === color ? 'selected' : ''}`} onClick={() => setDraft({ ...draft, color })} aria-label={`${color} accent`}><i /></button>)}</div>
              </section>

              <section className="create-section">
                <div className="create-section-heading"><span>2</span><div><strong>Behavior</strong><small>Choose its role, then write the instruction the runner receives.</small></div></div>
                <div className="role-picker">{(['agent', 'judge', 'router', 'tool', 'human'] as ComponentKind[]).map((kind) => <button key={kind} className={draft.kind === kind ? 'selected' : ''} onClick={() => setDraft({ ...draft, kind })}><ComponentIcon icon={kind === 'router' ? 'split' : kind === 'tool' ? 'terminal' : kind === 'human' ? 'user-check' : kind === 'judge' ? 'scan' : 'bot'} /><span>{kind === 'router' ? 'Decision' : kind}</span></button>)}</div>
                <div className="editor-form"><label><span>Instructions</span><textarea rows={11} value={draft.instruction} onChange={(event) => setDraft({ ...draft, instruction: event.target.value })} placeholder="Review the rendered interface. Focus on keyboard navigation, semantic structure, labels, focus order, and contrast. Return a verdict and prioritized findings…" /></label><details><summary>Input and output contract · optional</summary><div className="two-column"><label><span>Inputs, comma separated</span><input value={draft.inputs} onChange={(event) => setDraft({ ...draft, inputs: event.target.value })} placeholder="preview_url, brief" /></label><label><span>Outputs</span><input value={draft.outputs} onChange={(event) => setDraft({ ...draft, outputs: event.target.value })} placeholder="verdict, findings" /></label></div></details></div>
              </section>
            </div>

            <aside className="component-create-preview">
              <span className="eyebrow">Board preview</span>
              <div className={`component-preview-node tone-${draft.color}`}>
                <div><span className="component-kind-dot"><ComponentIcon icon={draft.icon} size={16} /></span><strong>{draft.name || 'Untitled component'}</strong></div>
                <p>{draft.description || 'A short purpose statement will appear here.'}</p>
                <small>{draft.kind}</small>
              </div>
              <div className="create-guidance"><Sparkles size={15} /><p><strong>Keep it reusable.</strong> Put project paths, branch names, and temporary objectives in project or run configuration—not this source instruction.</p></div>
            </aside>
          </div>
          <div className="editor-actions component-create-actions"><span>{!draft.name.trim() || !draft.instruction.trim() ? 'Name and instructions are required' : `Will create components/${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`}</span><button className="secondary-cta" onClick={() => setCreating(false)}>Cancel</button><button className="primary-cta" onClick={create} disabled={!draft.name.trim() || !draft.instruction.trim()}>Create component</button></div>
        </> : selectedModule ? <>
          <div className="editor-title"><div><span className="eyebrow">Reusable module</span><h2>{selectedModule.name}</h2></div><span className="status-chip ready">v{selectedModule.version}</span></div>
          {selectedModule.source === 'user' ? <div className="editor-form module-contract-editor"><label><span>Module name</span><input value={moduleDraft.name} onChange={(event) => setModuleDraft({ ...moduleDraft, name: event.target.value })} /></label><label><span>Description</span><input value={moduleDraft.description} onChange={(event) => setModuleDraft({ ...moduleDraft, description: event.target.value })} /></label><div className="two-column"><label><span>Inputs, comma separated</span><input value={moduleDraft.inputs} onChange={(event) => setModuleDraft({ ...moduleDraft, inputs: event.target.value })} /></label><label><span>Outputs, comma separated</span><input value={moduleDraft.outputs} onChange={(event) => setModuleDraft({ ...moduleDraft, outputs: event.target.value })} /></label></div></div> : <p className="editor-description">{selectedModule.description}</p>}
          <div className="contract-grid"><div><span>Contains</span><strong>{selectedModule.nodes.length} components</strong></div><div><span>Inputs</span><strong>{selectedModule.inputs.length || 'None'}</strong></div><div><span>Outputs</span><strong>{selectedModule.outputs.length || 'None'}</strong></div></div>
          <div className="module-editor-graph">{selectedModule.nodes.map((node, index) => <div key={node.id}><em>{index + 1}</em><strong>{node.componentId.replaceAll('-', ' ')}</strong>{index < selectedModule.nodes.length - 1 && <span />}</div>)}</div>
          <div className="source-footer"><div className="source-path"><Layers3 size={14} /> modules/{selectedModule.id}.json</div><span className="module-edit-note">Add it to a workspace, then use <strong>Expand module</strong> to edit its components and transitions.</span>{selectedModule.source === 'user' ? <button className="primary-cta" onClick={saveModule}>Save contract</button> : <button className="secondary-cta" onClick={customizeModule}>Customize a copy</button>}</div>
        </> : selected ? <>
          <div className="editor-title"><div><span className="eyebrow">Reusable component</span><h2>{selected.name}</h2></div><span className="status-chip ready">v{selected.version}</span></div>
          <p className="editor-description">{selected.description}</p>
          <div className="contract-grid"><div><span>Role</span><strong>{selected.kind}</strong></div><div><span>Inputs</span><strong>{selected.inputs.length || 'None'}</strong></div><div><span>Outputs</span><strong>{selected.outputs.length || 'None'}</strong></div></div>
          <div className="editor-form"><label><span>Markdown instructions</span><textarea className="source-editor" rows={18} value={instruction} onChange={(event) => setInstruction(event.target.value)} readOnly={!selected.tags.includes('custom')} /></label></div>
          <div className="source-footer"><div className="source-path"><FileCode2 size={14} /> components/{selected.id}.md</div>{selected.tags.includes('custom') ? <button className="primary-cta" onClick={saveComponent}>Save changes</button> : <button className="secondary-cta" onClick={customize}>Customize a copy</button>}</div>
        </> : null}
      </div>
    </div>
    <CatalystsPage embedded catalysts={catalysts} workflows={workflows} onCreate={onCreateCatalyst} onToggle={onToggleCatalyst} />
  </div>
}

function ProjectsPage({ project, onUpdate }: { project: ProjectContext; onUpdate: (project: ProjectContext) => void }) {
  const variables = Object.entries(project.variables)
  const connected = Boolean(project.root)
  const profile = project.profile ?? { status: 'not-scanned' as const, structure: 'unknown' as const, packageManager: 'auto' as const, capabilities: [], instructions: ['AGENTS.md', 'CLAUDE.md'], commands: {} }
  const updateProfile = (patch: Partial<NonNullable<ProjectContext['profile']>>) => onUpdate({ ...project, profile: { ...profile, ...patch } })
  const capabilityOptions: { id: ProjectCapability; label: string; detail: string }[] = [
    { id: 'web', label: 'Web interface', detail: 'Browser, visual, and accessibility checks.' },
    { id: 'service', label: 'API or service', detail: 'Contract and integration boundaries.' },
    { id: 'database', label: 'Database', detail: 'Schema and migration safety.' },
    { id: 'containers', label: 'Containers', detail: 'Docker-backed local services.' },
    { id: 'documentation', label: 'Documentation', detail: 'Docs and knowledge synchronization.' },
    { id: 'benchmarks', label: 'Benchmarks', detail: 'Measured regression comparison.' },
  ]
  const updateDefaults = (patch: Partial<ProjectContext['defaults']>) => onUpdate({ ...project, defaults: { ...project.defaults, ...patch } })
  const updatePermissions = (patch: Partial<ProjectContext['permissions']>) => onUpdate({ ...project, permissions: { ...project.permissions, ...patch } })
  const updateVariable = (oldKey: string, key: string, value: string) => {
    const next = { ...project.variables }
    delete next[oldKey]
    next[key] = value
    onUpdate({ ...project, variables: next })
  }
  const addVariable = () => {
    let key = 'new.variable'
    let suffix = 2
    while (key in project.variables) {
      key = `new.variable.${suffix}`
      suffix += 1
    }
    onUpdate({ ...project, variables: { ...project.variables, [key]: '' } })
  }
  const removeVariable = (key: string) => {
    const next = { ...project.variables }
    delete next[key]
    onUpdate({ ...project, variables: next })
  }
  const toggleTool = (tool: RelayTool) => updateDefaults({
    tools: project.defaults.tools.includes(tool)
      ? project.defaults.tools.filter((item) => item !== tool)
      : [...project.defaults.tools, tool],
  })

  return <div className="page-wrap configure-page">
    <PageHeading eyebrow="Workspace defaults" title="Configure project" description="Set the repository context and execution defaults once. Individual workflow components can inherit these values or override them explicitly." />

    <div className="configuration-summary" role="status">
      <div><span className={`configuration-status ${connected ? 'connected' : ''}`}><CircleDot size={13} /> {connected ? 'Project connected' : 'Directory required'}</span><strong>{connected ? project.root : 'Choose the directory the local runner should open.'}</strong></div>
      <div><span>Default runtime</span><strong>{project.defaults.model} · {project.defaults.effort} effort · {project.defaults.maxParallelAgents} parallel</strong></div>
      <div><span>Tools enabled</span><strong>{project.defaults.tools.length || 'None'}</strong></div>
    </div>

    <div className="configure-grid">
      <section className="surface configure-card repository-settings">
        <div className="configure-card-heading"><span><HardDrive size={17} /></span><div><span className="eyebrow">Repository</span><h2>Directory and branch</h2><p>The CLI runner uses this as its working boundary.</p></div></div>
        <div className="editor-form">
          <label><span>Display name</span><input value={project.name === 'No project selected' ? '' : project.name} onChange={(event) => onUpdate({ ...project, name: event.target.value || 'No project selected' })} placeholder="Remember" /></label>
          <label><span>Repository directory <em>Required to execute</em></span><div className="input-with-icon"><FolderGit2 size={14} /><input value={project.root} onChange={(event) => onUpdate({ ...project, root: event.target.value })} placeholder="/Users/you/Desktop/Repos/project" /></div></label>
          <label><span>Working branch</span><div className="input-with-icon"><GitBranch size={14} /><input value={project.branch} onChange={(event) => onUpdate({ ...project, branch: event.target.value })} placeholder="main or inherit current branch" /></div></label>
        </div>
      </section>

      <section className="surface configure-card runtime-defaults-card">
        <div className="configure-card-heading"><span><Cpu size={17} /></span><div><span className="eyebrow">Agent runtime</span><h2>Model and effort</h2><p>Defaults for agent and judge components.</p></div></div>
        <div className="editor-form">
          <label><span>Default model</span><input list="project-model-suggestions" value={project.defaults.model} onChange={(event) => updateDefaults({ model: event.target.value })} placeholder="auto or provider/model-id" /><datalist id="project-model-suggestions"><option value="auto" /><option value="openai/model-id" /><option value="anthropic/model-id" /><option value="google/model-id" /></datalist><small>Use the exact model identifier understood by your runner, or <code>auto</code>.</small></label>
          <label><span>Reasoning effort</span><select value={project.defaults.effort} onChange={(event) => updateDefaults({ effort: event.target.value as ReasoningEffort })}><option value="low">Low · faster</option><option value="medium">Medium · balanced</option><option value="high">High · thorough</option><option value="xhigh">X-high · deepest</option></select></label>
          <label><span>Maximum parallel agents</span><div className="parallel-control"><input type="range" min="1" max="16" value={project.defaults.maxParallelAgents} onChange={(event) => updateDefaults({ maxParallelAgents: Number(event.target.value) })} /><strong>{project.defaults.maxParallelAgents}</strong></div></label>
        </div>
      </section>
    </div>

    <section className="surface project-profile-card">
      <div className="surface-heading"><div><span className="eyebrow">Specification context</span><h2>Project profile</h2><p>The run preflight verifies this profile against the repository and uses it to resolve optional modules and project commands.</p></div><button className="secondary-cta" disabled={!connected} onClick={() => updateProfile({ status: 'scan-requested', scannedAt: undefined })}><ScanSearch size={14} /> Refresh with runner</button></div>
      <div className="profile-status-line"><span className={`configuration-status ${profile.status === 'ready' ? 'connected' : ''}`}><CircleDot size={12} /> {profile.status.replaceAll('-', ' ')}</span><p>{profile.status === 'scan-requested' ? 'The next connected run will perform a repository sweep before materializing its run specification.' : 'You can set known facts now; the runner treats them as hints until verified.'}</p></div>
      <div className="profile-fields">
        <label><span>Repository shape</span><select value={profile.structure} onChange={(event) => updateProfile({ structure: event.target.value as typeof profile.structure, status: 'configured' })}><option value="unknown">Detect during preflight</option><option value="single-package">Single package</option><option value="monorepo">Monorepo</option><option value="multi-repository">Multiple repositories</option></select></label>
        <label><span>Package manager</span><select value={profile.packageManager} onChange={(event) => updateProfile({ packageManager: event.target.value as typeof profile.packageManager, status: 'configured' })}><option value="auto">Detect during preflight</option><option value="pnpm">pnpm</option><option value="npm">npm</option><option value="yarn">Yarn</option><option value="bun">Bun</option><option value="python">Python</option><option value="mixed">Mixed toolchain</option></select></label>
      </div>
      <div className="capability-heading"><strong>Known capabilities</strong><span>Optional—preflight will verify these</span></div>
      <div className="capability-grid">{capabilityOptions.map((capability) => { const selected = profile.capabilities.includes(capability.id); return <button key={capability.id} className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => updateProfile({ status: 'configured', capabilities: selected ? profile.capabilities.filter((item) => item !== capability.id) : [...profile.capabilities, capability.id] })}><span>{selected ? <CheckCircle2 size={14} /> : <Plus size={14} />}</span><div><strong>{capability.label}</strong><small>{capability.detail}</small></div></button> })}</div>
    </section>

    <div className="configure-grid secondary-configure-grid">
      <section className="surface configure-card tool-defaults-card">
        <div className="configure-card-heading"><span><Wrench size={17} /></span><div><span className="eyebrow">Project allowlist</span><h2>Tools</h2><p>Components inherit these and may narrow them for one node.</p></div></div>
        <div className="project-tool-grid">{projectTools.map((tool) => <button key={tool.id} className={project.defaults.tools.includes(tool.id) ? 'selected' : ''} aria-pressed={project.defaults.tools.includes(tool.id)} onClick={() => toggleTool(tool.id)}><span><Wrench size={14} /></span><div><strong>{tool.label}</strong><small>{tool.detail}</small></div><i /></button>)}</div>
      </section>

      <section className="surface configure-card permission-settings-card">
        <div className="configure-card-heading"><span><ShieldCheck size={17} /></span><div><span className="eyebrow">Safety boundary</span><h2>Permissions</h2><p>A workflow can narrow these defaults, never widen them.</p></div></div>
        <div className="permission-settings">
          <label className="permission-toggle"><div><strong>Spawn configured agents</strong><small>Allow the driver to create child agents.</small></div><input type="checkbox" checked={project.permissions.spawnAgents} onChange={(event) => updatePermissions({ spawnAgents: event.target.checked })} /></label>
          <label><div><strong>Shell access</strong><small>Maximum filesystem and command scope.</small></div><select value={project.permissions.shell} onChange={(event) => updatePermissions({ shell: event.target.value as ProjectContext['permissions']['shell'] })}><option value="project">Project only</option><option value="read-only">Read only</option><option value="none">None</option></select></label>
          <label><div><strong>Network access</strong><small>Policy for outbound connections.</small></div><select value={project.permissions.network} onChange={(event) => updatePermissions({ network: event.target.value as ProjectContext['permissions']['network'] })}><option value="ask">Ask first</option><option value="allow">Allow</option><option value="deny">Deny</option></select></label>
          <label><div><strong>Publish changes</strong><small>Pushes, releases, and external writes.</small></div><select value={project.permissions.publish} onChange={(event) => updatePermissions({ publish: event.target.value as ProjectContext['permissions']['publish'] })}><option value="ask">Ask first</option><option value="allow">Allow</option><option value="deny">Deny</option></select></label>
        </div>
      </section>
    </div>

    <section className="surface variables-surface configured-variables">
      <div className="surface-heading"><div><span className="eyebrow">Reusable context</span><h2>Variables</h2></div><button className="secondary-cta" onClick={addVariable}><Plus size={14} /> Add variable</button></div>
      <p>Values replace matching placeholders such as <code>{'{{preview.url}}'}</code> when the workflow is compiled. Secrets should remain references resolved by the runner.</p>
      <div className="variable-table-heading"><span>Variable</span><span>Value</span><span /></div>
      {variables.map(([key, value]) => <div className="variable-row" key={key}><input aria-label="Variable name" value={key} onChange={(event) => updateVariable(key, event.target.value, value)} /><input aria-label={`Value for ${key}`} value={value} onChange={(event) => updateVariable(key, key, event.target.value)} /><button onClick={() => removeVariable(key)} aria-label={`Remove ${key}`}><Trash2 size={14} /></button></div>)}
      {!variables.length && <div className="variables-empty"><Globe2 size={17} /> No project variables yet. Add one when a component needs reusable context.</div>}
    </section>
  </div>
}

function TemplatesPage({ templates, modules, onCreate, onTogglePublished, onUseTemplate }: { templates: WorkflowTemplate[]; modules: WorkflowModuleDefinition[]; onCreate: (template: WorkflowTemplate) => void; onTogglePublished: (id: string) => void; onUseTemplate: (template: WorkflowTemplate) => void }) {
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState({ name: '', description: '', level: 'Guided' as WorkflowTemplate['level'], moduleIds: [] as string[], published: false })
  const visible = templates.filter((template) => `${template.name} ${template.description} ${template.steps.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const create = () => {
    if (!draft.name.trim() || !draft.description.trim() || !draft.moduleIds.length) return
    const id = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const selectedModules = draft.moduleIds.map((moduleId) => modules.find((module) => module.id === moduleId)).filter((module): module is WorkflowModuleDefinition => Boolean(module))
    onCreate({ id, name: draft.name.trim(), description: draft.description.trim(), level: draft.level, steps: selectedModules.map((module) => module.name), componentIds: [], moduleIds: selectedModules.map((module) => module.id), adaptationRules: [], source: 'user', published: draft.published, createdAt: new Date().toISOString() })
    setCreating(false)
    setDraft({ name: '', description: '', level: 'Guided', moduleIds: [], published: false })
  }
  return <div className="page-wrap"><PageHeading eyebrow="Starting points" title="Templates" description="Stable workflow blueprints assembled from reusable modules. Each run gets a project- and objective-specific specification before execution." action={<button className="primary-cta" onClick={() => setCreating(true)}><Plus size={15} /> New template</button>} />
    <section className="template-preflight-note"><Sparkles size={16} /><div><strong>Templates stay reusable; runs become specific.</strong><span>The specification preflight selects optional modules, resolves project commands, and records every adaptation in <code>run-spec.json</code>.</span></div></section>
    {creating && <section className="surface template-create"><div className="editor-title"><div><span className="eyebrow">Save reusable workflow</span><h2>Create template</h2></div><button className="icon-button" onClick={() => setCreating(false)}><X size={16} /></button></div><div className="editor-form two-column"><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="My release workflow" /></label><label><span>Complexity</span><select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value as WorkflowTemplate['level'] })}><option>Guided</option><option>Advanced</option></select></label></div><div className="editor-form"><label><span>Description</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Explain when another user should choose this template." /></label><div className="template-module-field"><span>Modules in order</span><p>Choose reusable compositions. Click in execution order.</p><div className="template-module-picker">{modules.map((module) => { const index = draft.moduleIds.indexOf(module.id); return <button key={module.id} className={index >= 0 ? 'selected' : ''} onClick={() => setDraft({ ...draft, moduleIds: index >= 0 ? draft.moduleIds.filter((id) => id !== module.id) : [...draft.moduleIds, module.id] })}>{index >= 0 && <em>{index + 1}</em>}<Layers3 size={13} /><span>{module.name}</span></button> })}</div></div><label className="publish-setting"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /><span><strong>Publish to community</strong><small>Make this template discoverable after registry review. Keep off for workspace-only use.</small></span></label></div><div className="editor-actions"><button className="secondary-cta" onClick={() => setCreating(false)}>Cancel</button><button className="primary-cta" onClick={create} disabled={!draft.name.trim() || !draft.description.trim() || !draft.moduleIds.length}>Create template</button></div></section>}
    <div className="template-toolbar"><label className="wide-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" /></label><span>{templates.filter((template) => template.source === 'user').length} created by you</span></div>
    <div className="template-grid">{visible.map((template) => <article className="surface template-card" key={template.id}><div className="template-visual"><Workflow size={24} /><span>{template.moduleIds?.length ?? template.steps.length} modules</span></div><div className="template-badges"><span className={`level-pill ${template.level.toLowerCase()}`}>{template.level}</span><span className={`visibility-pill ${template.published ? 'published' : 'private'}`}>{template.source === 'built-in' ? 'Relay' : template.published ? 'Published' : 'Private'}</span></div><h2>{template.name}</h2><p>{template.description}</p><div className="template-steps">{template.steps.map((step) => <span key={step}>{step}</span>)}</div>{Boolean(template.adaptationRules?.length) && <div className="template-adaptation"><Sparkles size={13} /><span>{template.adaptationRules!.length} optional module {template.adaptationRules!.length === 1 ? 'rule' : 'rules'} resolved during preflight</span></div>}<div className="template-actions"><button className="secondary-cta" onClick={() => onUseTemplate(template)}>Use template <ArrowRight size={13} /></button>{template.source === 'user' && <button className={`publish-toggle ${template.published ? 'on' : ''}`} onClick={() => onTogglePublished(template.id)} aria-label={`${template.published ? 'Unpublish' : 'Publish'} ${template.name}`}><i /><span>{template.published ? 'Published' : 'Private'}</span></button>}</div></article>)}</div>
  </div>
}

const catalystKinds: Record<CatalystKind, { label: string; detail: string; security: CatalystDefinition['security']; Icon: typeof Zap }> = {
  'signed-webhook': { label: 'Signed webhook', detail: 'Receive a verified event from an external system.', security: 'hmac', Icon: Webhook },
  'connector-event': { label: 'Connector event', detail: 'Subscribe through an authorized workspace connector.', security: 'connector-oauth', Icon: Cable },
  cron: { label: 'Schedule', detail: 'Start from a simple runner-managed schedule.', security: 'runner-token', Icon: Clock3 },
  'secure-query': { label: 'Secure query', detail: 'Accept an authenticated, schema-limited request.', security: 'runner-token', Icon: KeyRound },
}

const defaultCatalystSettings = {
  provider: 'github',
  webhookEvent: 'pull_request.opened',
  connector: 'github',
  connectorEvent: 'pull_request.opened',
  frequency: 'weekdays',
  time: '09:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  request: 'repository-audit',
  scope: 'workspace',
}

const webhookEvents: Record<string, { value: string; label: string }[]> = {
  github: [{ value: 'pull_request.opened', label: 'Pull request opened' }, { value: 'pull_request.synchronize', label: 'Pull request updated' }, { value: 'push', label: 'Code pushed' }],
  stripe: [{ value: 'payment_intent.succeeded', label: 'Payment succeeded' }, { value: 'invoice.payment_failed', label: 'Payment failed' }, { value: 'customer.subscription.updated', label: 'Subscription updated' }],
  custom: [{ value: 'event.received', label: 'Any verified event' }],
}

const connectorEvents: Record<string, { value: string; label: string }[]> = {
  github: webhookEvents.github,
  linear: [{ value: 'issue.created', label: 'Issue created' }, { value: 'issue.updated', label: 'Issue updated' }, { value: 'comment.created', label: 'Comment added' }],
  slack: [{ value: 'message.mentioned', label: 'App mentioned' }, { value: 'reaction.added', label: 'Reaction added' }, { value: 'shortcut.used', label: 'Shortcut used' }],
}

const catalystSelector = (kind: CatalystKind, settings: typeof defaultCatalystSettings) => {
  if (kind === 'signed-webhook') return `${settings.provider}:${settings.webhookEvent}`
  if (kind === 'connector-event') return `${settings.connector}.${settings.connectorEvent}`
  if (kind === 'cron') return `schedule:${settings.frequency}:${settings.time}:${settings.timezone}`
  return `query:${settings.request}:${settings.scope}`
}

function CatalystsPage({ catalysts, workflows, onCreate, onToggle, embedded = false }: { catalysts: CatalystDefinition[]; workflows: WorkflowRecord[]; onCreate: (catalyst: CatalystDefinition) => void; onToggle: (id: string) => void; embedded?: boolean }) {
  const catalystWorkflows = workflows.filter((workflow) => workflow.entryMode === 'catalyst')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', kind: 'connector-event' as CatalystKind, workflowId: '', settings: { ...defaultCatalystSettings } })
  const kind = catalystKinds[draft.kind]
  const openCreator = () => {
    if (!catalystWorkflows.length) return
    setEditingId(null)
    setDraft({ name: '', kind: 'connector-event', workflowId: catalystWorkflows[0].id, settings: { ...defaultCatalystSettings } })
    setCreating(true)
  }
  const openEditor = (catalyst: CatalystDefinition) => {
    setEditingId(catalyst.id)
    setDraft({ name: catalyst.name, kind: catalyst.kind, workflowId: catalyst.workflowId, settings: { ...defaultCatalystSettings, ...catalyst.settings } })
    setCreating(true)
  }
  const create = () => {
    const workflow = catalystWorkflows.find((item) => item.id === draft.workflowId)
    if (!workflow || !draft.name.trim()) return
    const existing = catalysts.find((item) => item.id === editingId)
    const id = editingId ?? draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    onCreate({ id, name: draft.name.trim(), kind: draft.kind, workflowId: workflow.id, workflowName: workflow.name, selector: catalystSelector(draft.kind, draft.settings), settings: draft.settings, security: kind.security, status: existing?.status ?? 'awaiting-runner', createdAt: existing?.createdAt ?? new Date().toISOString() })
    setCreating(false)
    setEditingId(null)
    setDraft({ name: '', kind: 'connector-event', workflowId: '', settings: { ...defaultCatalystSettings } })
  }

  const updateSetting = (key: keyof typeof defaultCatalystSettings, value: string) => setDraft((current) => ({ ...current, settings: { ...current.settings, [key]: value } }))
  const guidedFields = draft.kind === 'signed-webhook' ? <div className="catalyst-guided-fields">
    <label><span>Service</span><select value={draft.settings.provider} onChange={(event) => { const provider = event.target.value; setDraft((current) => ({ ...current, settings: { ...current.settings, provider, webhookEvent: webhookEvents[provider][0].value } })) }}><option value="github">GitHub</option><option value="stripe">Stripe</option><option value="custom">Custom service</option></select></label>
    <label><span>Event</span><select value={draft.settings.webhookEvent} onChange={(event) => updateSetting('webhookEvent', event.target.value)}>{webhookEvents[draft.settings.provider].map((event) => <option key={event.value} value={event.value}>{event.label}</option>)}</select></label>
  </div> : draft.kind === 'connector-event' ? <div className="catalyst-guided-fields">
    <label><span>Connector</span><select value={draft.settings.connector} onChange={(event) => { const connector = event.target.value; setDraft((current) => ({ ...current, settings: { ...current.settings, connector, connectorEvent: connectorEvents[connector][0].value } })) }}><option value="github">GitHub</option><option value="linear">Linear</option><option value="slack">Slack</option></select></label>
    <label><span>Event</span><select value={draft.settings.connectorEvent} onChange={(event) => updateSetting('connectorEvent', event.target.value)}>{connectorEvents[draft.settings.connector].map((event) => <option key={event.value} value={event.value}>{event.label}</option>)}</select></label>
  </div> : draft.kind === 'cron' ? <div className="catalyst-guided-fields">
    <label><span>Repeats</span><select value={draft.settings.frequency} onChange={(event) => updateSetting('frequency', event.target.value)}><option value="hourly">Every hour</option><option value="daily">Every day</option><option value="weekdays">Every weekday</option><option value="weekly">Every week</option></select></label>
    <label><span>Start time</span><input type="time" value={draft.settings.time} onChange={(event) => updateSetting('time', event.target.value)} disabled={draft.settings.frequency === 'hourly'} /></label>
    <label className="full"><span>Timezone</span><select value={draft.settings.timezone} onChange={(event) => updateSetting('timezone', event.target.value)}>{[...new Set([defaultCatalystSettings.timezone, 'UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London'])].map((timezone) => <option key={timezone} value={timezone}>{timezone.replaceAll('_', ' ')}</option>)}</select></label>
  </div> : <div className="catalyst-guided-fields">
    <label><span>Request type</span><select value={draft.settings.request} onChange={(event) => updateSetting('request', event.target.value)}><option value="repository-audit">Repository audit</option><option value="dependency-risk">Dependency risk review</option><option value="release-readiness">Release readiness check</option><option value="custom-objective">Schema-limited objective</option></select></label>
    <label><span>Who may request it</span><select value={draft.settings.scope} onChange={(event) => updateSetting('scope', event.target.value)}><option value="workspace">Workspace members</option><option value="service-account">Approved service account</option><option value="runner-token">Runner token holders</option></select></label>
  </div>

  const content = <><PageHeading eyebrow="Workflow entrypoints" title="Catalysts" description="Define what may start a workflow. Relay verifies the event at the receiver, records its provenance, then creates a normal auditable run." action={<button className="primary-cta" disabled={!catalystWorkflows.length} title={!catalystWorkflows.length ? 'Add and connect a Catalyst component in a workflow first' : undefined} onClick={openCreator}><Plus size={15} /> New catalyst</button>} />
    {!catalystWorkflows.length && <section className="catalyst-prerequisite"><Zap size={17} /><div><strong>Stage a catalyst workflow first</strong><span>Add the Catalyst component as the first node, connect it to the first executable step, then choose Stage in the builder. Workflows without it remain manual.</span></div></section>}
    {creating && <section className="surface catalyst-create"><div className="editor-title"><div><span className="eyebrow">Secure entrypoint</span><h2>{editingId ? 'Edit catalyst' : 'Configure a catalyst'}</h2></div><button className="icon-button" onClick={() => { setCreating(false); setEditingId(null) }}><X size={16} /></button></div><div className="catalyst-create-grid"><div className="catalyst-kind-grid">{(Object.entries(catalystKinds) as [CatalystKind, typeof kind][]).map(([id, option]) => { const Icon = option.Icon; return <button className={draft.kind === id ? 'selected' : ''} key={id} onClick={() => setDraft({ ...draft, kind: id })}><Icon size={17} /><strong>{option.label}</strong><small>{option.detail}</small></button> })}</div><div className="editor-form catalyst-fields"><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="PR quality check" /></label><label><span>Catalyst workflow</span><select value={draft.workflowId} onChange={(event) => setDraft({ ...draft, workflowId: event.target.value })}>{catalystWorkflows.map((workflow) => <option value={workflow.id} key={workflow.id}>{workflow.name}</option>)}</select></label>{guidedFields}<div className="catalyst-security"><ShieldCheck size={16} /><div><strong>{kind.security === 'hmac' ? 'HMAC signature required' : kind.security === 'connector-oauth' ? 'Connector authorization required' : 'Runner token required'}</strong><span>Secrets are referenced by name and resolved by the receiver. They are never stored in workflow JSON.</span></div></div><div className="editor-actions"><button className="secondary-cta" onClick={() => { setCreating(false); setEditingId(null) }}>Cancel</button><button className="primary-cta" onClick={create} disabled={!draft.name.trim() || !draft.workflowId}>Save catalyst</button></div></div></div></section>}
    {catalysts.length ? <div className="catalyst-list">{catalysts.map((catalyst) => { const option = catalystKinds[catalyst.kind]; const Icon = option.Icon; return <article className="surface catalyst-card" key={catalyst.id} role="button" tabIndex={0} onClick={() => openEditor(catalyst)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openEditor(catalyst) }}><span className="catalyst-card-icon"><Icon size={18} /></span><div className="catalyst-card-main"><div><span className="eyebrow">{option.label}</span><h2>{catalyst.name}</h2></div><p>{describeCatalyst(catalyst)}</p><div className="catalyst-route"><span><Zap size={12} /> {catalyst.workflowName}</span><ArrowRight size={12} /><span><ShieldCheck size={12} /> {catalyst.security}</span></div></div><div className="catalyst-card-state"><span className={`status-chip ${catalyst.status === 'paused' ? 'draft' : 'ready'}`}><i /> {catalyst.status === 'paused' ? 'Paused' : 'Awaiting receiver'}</span><button className="secondary-cta" onClick={(event) => { event.stopPropagation(); onToggle(catalyst.id) }}>{catalyst.status === 'paused' ? 'Enable' : 'Pause'}</button></div></article> })}</div> : <section className="surface catalyst-empty"><span><Webhook size={22} /></span><h2>No catalysts configured</h2><p>Create a signed hook, connector subscription, schedule, or secure query. Nothing listens publicly until a Relay receiver is connected and authorized.</p><button className="secondary-cta" disabled={!catalystWorkflows.length} onClick={openCreator}>Configure first catalyst <ArrowRight size={13} /></button></section>}
    <section className="catalyst-boundary"><ShieldCheck size={17} /><div><strong>Receiver boundary</strong><span>The website authors catalyst definitions. A local daemon or hosted Relay receiver performs signature checks, connector authentication, replay protection, rate limits, and idempotency before creating a run.</span></div></section>
  </>
  return embedded ? <section className="embedded-catalysts">{content}</section> : <div className="page-wrap">{content}</div>
}

function RunsPage({ onNavigate, stagedRuns, onUpdateStagedRuns, workflows, board, onUpdateBoard, catalysts }: { onNavigate: (page: AppPage) => void; stagedRuns: PendingRun[]; onUpdateStagedRuns: (runs: PendingRun[]) => void; workflows: WorkflowRecord[]; board: RunMonitorBoard; onUpdateBoard: (board: RunMonitorBoard) => void; catalysts: CatalystDefinition[] }) {
  return <div className="run-board-page"><RunBoard board={board} workflows={workflows} stagedRuns={stagedRuns} catalysts={catalysts} onUpdateStagedRuns={onUpdateStagedRuns} onChange={onUpdateBoard} onOpenBuilder={() => onNavigate('builder')} onOpenCatalysts={() => onNavigate('catalysts')} /></div>
}
