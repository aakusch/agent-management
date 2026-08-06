import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Blocks,
  Bot,
  Cable,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Cpu,
  FileCode2,
  FolderGit2,
  GitBranch,
  Globe2,
  HardDrive,
  Layers3,
  KeyRound,
  Moon,
  ClipboardCopy,
  Import,
  MoreHorizontal,
  PenLine,
  Play,
  Plus,
  ScanSearch,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Webhook,
  Zap,
  Workflow,
  Wrench,
  X,
} from 'lucide-react'
import type { ComponentKind, ComponentTemplate, ProjectCapability, ProjectContext, ReasoningEffort, RelayTool, WorkflowModuleDefinition } from '../types/workflow'
import type { CatalystDefinition, CatalystKind, PendingRun, RunMonitorBoard, WorkflowRecord, WorkflowTemplate } from '../types/catalog'
import { AGENT_AUTHORING_SPEC, clearReview, describeAssets, REVIEW_TAG, mergeParsedAssets, needsReview, parseAssetFile, type ParsedAssets } from '../lib/assets'
import { componentColors, componentIconOptions, iconFor, iconForKind } from '../lib/componentIcons'
import { useDismissOnOutside } from '../lib/hooks'
import { slugify, uniqueId } from '../lib/ids'
import { RunBoard } from './RunBoard'
import { StartRunModal, type RunConfiguration } from './StartRunModal'
import { describeCatalyst } from '../lib/catalysts'

export type AppPage = 'dashboard' | 'builder' | 'module-builder' | 'workflows' | 'components' | 'projects' | 'templates' | 'catalysts' | 'runs'

interface ManagementProps {
  page: Exclude<AppPage, 'builder' | 'module-builder'>
  onNavigate: (page: AppPage) => void
  onComposeModule: (moduleId: string | null) => void
  onImportAssets: (assets: ParsedAssets) => void
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
  onOpenWorkflow: (workflow: WorkflowRecord) => void
  onNewWorkflow: () => void
  onDeleteWorkflow: (workflow: WorkflowRecord) => void
  workflowsNesting: (workflowId: string) => string[]
  buildTemplateFromWorkflow: (workflowId: string, draft: { name: string; description: string; level: WorkflowTemplate['level']; published: boolean }) => { template?: WorkflowTemplate; error?: string }
  fileBridge: { status: 'checking' | 'files' | 'browser'; root?: string; problems: string[] }
  onDeleteComponent: (componentId: string) => void
  onDeleteModule: (moduleId: string) => void
  onDeleteCatalyst: (catalystId: string) => void
  componentUsage: (componentId: string) => string[]
  moduleUsage: (moduleId: string) => string[]
  catalystUsage: (catalystId: string) => string[]
  onStageWorkflow: (workflow: WorkflowRecord, configuration: RunConfiguration) => void
  stagedRuns: PendingRun[]
  onUpdateStagedRuns: (runs: PendingRun[]) => void
  monitorBoard: RunMonitorBoard
  onUpdateMonitorBoard: (update: (board: RunMonitorBoard) => RunMonitorBoard) => void
  catalysts: CatalystDefinition[]
  onCreateCatalyst: (catalyst: CatalystDefinition) => void
  onToggleCatalyst: (id: string) => void
}

const pageLabels: Record<Exclude<AppPage, 'builder' | 'module-builder'>, string> = {
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

const projectTools: { id: RelayTool; label: string; detail: string }[] = [
  { id: 'filesystem', label: 'Files', detail: 'Read and edit within the project.' },
  { id: 'terminal', label: 'Terminal', detail: 'Run approved project commands.' },
  { id: 'git', label: 'Git', detail: 'Inspect diffs, branches, and history.' },
  { id: 'browser', label: 'Browser', detail: 'Test local interfaces and flows.' },
  { id: 'web', label: 'Web', detail: 'Access permitted external sources.' },
]

function ComponentIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  const Icon = iconFor(icon)
  return <Icon size={size} strokeWidth={1.8} />
}

export function Management({
  page,
  onNavigate,
  onComposeModule,
  onImportAssets,
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
  onOpenWorkflow,
  onNewWorkflow,
  onDeleteWorkflow,
  workflowsNesting,
  buildTemplateFromWorkflow,
  fileBridge,
  onDeleteComponent,
  onDeleteModule,
  onDeleteCatalyst,
  componentUsage,
  moduleUsage,
  catalystUsage,
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
  const overflowRef = useDismissOnOutside<HTMLDivElement>(overflowOpen, () => setOverflowOpen(false))

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
          <span className={`storage-mode ${fileBridge.status}`} title={fileBridge.status === 'files'
            ? `Assets read and written in ${fileBridge.root}${fileBridge.problems.length ? ` · ${fileBridge.problems.length} file(s) could not be read` : ''}`
            : 'No dev filesystem bridge — assets live in this browser only and the CLI cannot see them'}>
            {fileBridge.status === 'files' ? <><HardDrive size={13} /> Repo files</> : fileBridge.status === 'browser' ? <><Globe2 size={13} /> Browser only</> : <><HardDrive size={13} /> Checking…</>}
            {Boolean(fileBridge.problems.length) && <em>{fileBridge.problems.length}</em>}
          </span>
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
          {page === 'dashboard' && <Dashboard onNavigate={onNavigate} onOpenWorkflow={onOpenWorkflow} onNewWorkflow={onNewWorkflow} onComposeModule={onComposeModule} onImportAssets={onImportAssets} project={project} components={components} modules={modules} templates={templates} workflows={workflows} />}
          {page === 'workflows' && <WorkflowsPage onOpenWorkflow={onOpenWorkflow} onNewWorkflow={onNewWorkflow} onDeleteWorkflow={onDeleteWorkflow} workflowsNesting={workflowsNesting} workflows={workflows} projectName={project.name} onStageWorkflow={onStageWorkflow} />}
          {page === 'components' && <ComponentsPage components={components} modules={modules} onCreate={onCreateComponent} onCreateModule={onCreateModule} onComposeModule={onComposeModule} onImportAssets={onImportAssets} onDeleteComponent={onDeleteComponent} onDeleteModule={onDeleteModule} onDeleteCatalyst={onDeleteCatalyst} componentUsage={componentUsage} moduleUsage={moduleUsage} catalystUsage={catalystUsage} catalysts={catalysts} workflows={workflows} onCreateCatalyst={onCreateCatalyst} onToggleCatalyst={onToggleCatalyst} />}
          {page === 'projects' && <ProjectsPage project={project} onUpdate={onUpdateProject} />}
          {page === 'templates' && <TemplatesPage templates={templates} workflows={workflows} onImportAssets={onImportAssets} onCreate={onCreateTemplate} onTogglePublished={onToggleTemplatePublished} onUseTemplate={onUseTemplate} buildTemplateFromWorkflow={buildTemplateFromWorkflow} />}
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

/** Shared file picker for agent- or teammate-authored components, modules, and templates. */
function AssetImportButton({ onImportAssets, label = 'Import', className = 'secondary-cta small', onDone }: { onImportAssets: (assets: ParsedAssets) => void; label?: string; className?: string; onDone?: (message: string, tone: 'success' | 'error') => void }) {
  const input = useRef<HTMLInputElement>(null)
  const read = async (files: FileList) => {
    try {
      const parsed = await Promise.all([...files].map(async (file) => {
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than the 5 MB import limit.`)
        return parseAssetFile(file.name, await file.text())
      }))
      const assets = mergeParsedAssets(parsed)
      onImportAssets(assets)
      onDone?.(`Imported ${describeAssets(assets)} · review before use`, 'success')
    } catch (error) {
      onDone?.(error instanceof Error ? error.message : 'Could not read those files.', 'error')
    }
  }
  return <>
    <input ref={input} type="file" accept=".md,.json,application/json,text/markdown" multiple hidden onChange={(event) => { const files = event.target.files; if (files?.length) void read(files); event.target.value = '' }} />
    <button className={className} onClick={() => input.current?.click()}><Import size={14} /> {label}</button>
  </>
}

function AgentSpecButton({ onDone }: { onDone?: (message: string, tone: 'success' | 'error') => void }) {
  return <button className="secondary-cta small" onClick={() => {
    navigator.clipboard?.writeText(AGENT_AUTHORING_SPEC)
      .then(() => onDone?.('Authoring spec copied — paste it to your agent', 'success'))
      .catch(() => onDone?.('Could not access the clipboard in this browser.', 'error'))
  }}><ClipboardCopy size={14} /> Copy agent spec</button>
}

const greeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

function Dashboard({ onNavigate, onOpenWorkflow, onNewWorkflow, onComposeModule, onImportAssets, project, components, modules, templates, workflows }: { onNavigate: (page: AppPage) => void; onOpenWorkflow: (workflow: WorkflowRecord) => void; onNewWorkflow: () => void; onComposeModule: (moduleId: string | null) => void; onImportAssets: (assets: ParsedAssets) => void; project: ProjectContext; components: ComponentTemplate[]; modules: WorkflowModuleDefinition[]; templates: WorkflowTemplate[]; workflows: WorkflowRecord[] }) {
  const projectConnected = Boolean(project.root)
  const [notice, setNotice] = useState<string | null>(null)
  const emptyWorkspace = !components.length && !modules.length
  return (
    <div className="page-wrap">
      <PageHeading
        eyebrow={emptyWorkspace ? 'Empty workspace' : greeting()}
        title={emptyWorkspace ? 'Nothing here yet — that is the point.' : 'Build reliable work, visually.'}
        description={emptyWorkspace
          ? 'Relay ships with no components or modules. Fill the library the way that suits you, then compose workflows from what you trust.'
          : 'Start with a proven workflow, adjust it for your project, then hand one complete assignment to your agent.'}
        action={<button className="primary-cta" onClick={onNewWorkflow}><Plus size={16} /> {emptyWorkspace ? 'Open builder' : 'New workflow'}</button>}
      />

      {(emptyWorkspace || notice) && <section className="surface start-paths-card">
        <div className="surface-heading"><div><span className="eyebrow">Three ways to start</span><h2>Fill your library</h2></div>{notice && <span className="start-path-notice">{notice}<button className="text-button" onClick={() => onNavigate('components')}>Review <ArrowRight size={12} /></button></span>}</div>
        <div className="start-paths">
          <article>
            <span className="start-path-mark"><Blocks size={17} /></span>
            <strong>Compose your own</strong>
            <p>Write a component — one clear job, one instruction — then wire several into a module on the canvas.</p>
            <div className="start-path-actions"><button className="secondary-cta small" onClick={() => onNavigate('components')}><Plus size={14} /> New component</button><button className="secondary-cta small" onClick={() => onComposeModule(null)}><Layers3 size={14} /> New module</button></div>
          </article>
          <article>
            <span className="start-path-mark"><Bot size={17} /></span>
            <strong>Let an agent draft them</strong>
            <p>Hand your agent the authoring spec, then import what it writes. Imported assets arrive flagged for your review.</p>
            <div className="start-path-actions"><AgentSpecButton onDone={(message) => setNotice(message)} /><AssetImportButton onImportAssets={onImportAssets} onDone={(message) => setNotice(message)} /></div>
          </article>
          <article>
            <span className="start-path-mark"><Layers3 size={17} /></span>
            <strong>Clone from a template</strong>
            <p>A template carries the components and modules it needs. Using one copies them into your library to edit from there.</p>
            <div className="start-path-actions"><button className="secondary-cta small" onClick={() => onNavigate('templates')}>{templates.length ? `Browse ${templates.length} templates` : 'Templates'} <ArrowRight size={13} /></button></div>
          </article>
        </div>
      </section>}

      <div className="metrics-grid metrics-grid-three">
        <Metric label="Workflows" value={String(workflows.length)} detail="Saved in this workspace" icon={Workflow} />
        <Metric label="Components" value={String(components.length)} detail={modules.length ? `${modules.length} module${modules.length === 1 ? '' : 's'} composed` : 'Markdown definitions available'} icon={Blocks} />
        <Metric label="Connected projects" value={projectConnected ? '1' : '0'} detail={projectConnected ? project.name : 'Connect a local repository'} icon={FolderGit2} />
      </div>

      {!emptyWorkspace && <section className="surface dashboard-workflows">
        <div className="surface-heading"><div><span className="eyebrow">Workspace</span><h2>All workflows</h2></div><button className="text-button" onClick={() => onNavigate('workflows')}>Manage workflows <ArrowRight size={13} /></button></div>
        <WorkflowRows workflows={workflows} onOpen={onOpenWorkflow} />
      </section>}

      {!projectConnected && <section className="surface getting-started-card dashboard-setup">
        <div className="surface-heading"><div><span className="eyebrow">Before the first run</span><h2>Connect the workflow to a project</h2></div></div>
        <div className="setup-steps">
          <SetupStep number="1" title="Connect a local repository" detail="Set the root, branch, commands, and project variables" onClick={() => onNavigate('projects')} />
          <SetupStep number="2" title="Fill the component library" detail="Write your own, import agent-authored assets, or clone a template" onClick={() => onNavigate('components')} />
          <SetupStep number="3" title="Compose and stage a workflow" detail="Wire the graph, then hand one complete assignment to the driver" onClick={onNewWorkflow} />
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

function WorkflowRows({ workflows, onOpen, onStage, onDelete }: { workflows: WorkflowRecord[]; onOpen: (workflow: WorkflowRecord) => void; onStage?: (workflow: WorkflowRecord) => void; onDelete?: (workflow: WorkflowRecord) => void }) {
  if (workflows.length === 0) return <div className="table-empty"><Workflow size={20} /><strong>No workflows yet</strong><span>Create one in the builder or start from a template.</span></div>
  return <div className="workflow-rows">{workflows.map((workflow) => <div className={`workflow-row-shell ${onStage ? 'has-stage-action' : ''}`} key={workflow.id}>
    <button className="workflow-row" onClick={() => onOpen(workflow)}>
      <span className="row-icon"><Workflow size={17} /></span><div className="row-main"><strong>{workflow.name}</strong><small>{workflow.description}</small></div><span>{workflow.nodeCount} steps</span><span>{workflow.projectName ?? 'Any project'}</span><span className={`status-chip ${workflow.status}`}>{workflow.status}</span><ChevronRight size={15} />
    </button>
    {onStage && <button className="workflow-stage-action" onClick={() => onStage(workflow)} disabled={workflow.entryMode === 'catalyst'} title={workflow.entryMode === 'catalyst' ? 'Catalyst workflows are staged from the builder.' : `Stage ${workflow.name}`}><Play size={13} /> {workflow.entryMode === 'catalyst' ? 'Catalyst' : 'Stage'}</button>}
    {onDelete && <button className="workflow-delete-action" onClick={() => onDelete(workflow)} aria-label={`Delete ${workflow.name}`} title={`Delete ${workflow.name}`}><Trash2 size={13} /></button>}
  </div>)}</div>
}

function WorkflowsPage({ onOpenWorkflow, onNewWorkflow, onDeleteWorkflow, workflowsNesting, workflows, projectName, onStageWorkflow }: { onOpenWorkflow: (workflow: WorkflowRecord) => void; onNewWorkflow: () => void; onDeleteWorkflow: (workflow: WorkflowRecord) => void; workflowsNesting: (workflowId: string) => string[]; workflows: WorkflowRecord[]; projectName: string; onStageWorkflow: (workflow: WorkflowRecord, configuration: RunConfiguration) => void }) {
  const [query, setQuery] = useState('')
  const [stagingWorkflow, setStagingWorkflow] = useState<WorkflowRecord | null>(null)
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowRecord | null>(null)
  const nestedIn = deletingWorkflow ? workflowsNesting(deletingWorkflow.id) : []
  const visibleWorkflows = workflows.filter((workflow) => `${workflow.name} ${workflow.description} ${workflow.projectName ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <div className="page-wrap"><PageHeading eyebrow="Library" title="Workflows" description="Saved ways of working. Stage one with an objective, or open it to customize the graph." action={<button className="primary-cta" onClick={onNewWorkflow}><Plus size={16} /> New workflow</button>} />
      <div className="filter-row"><label className="wide-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows" /></label><button className="filter-button" onClick={() => setQuery('')}>All projects <ChevronRight size={13} /></button></div>
      <div className="workflow-table surface">
        <WorkflowRows workflows={visibleWorkflows} onOpen={onOpenWorkflow} onStage={setStagingWorkflow} onDelete={setDeletingWorkflow} />
      </div>
    </div>
    {stagingWorkflow && <StartRunModal workflowName={stagingWorkflow.name} projectName={stagingWorkflow.projectName ?? projectName} onClose={() => setStagingWorkflow(null)} onStart={(configuration) => { onStageWorkflow(stagingWorkflow, configuration); setStagingWorkflow(null) }} />}
    {deletingWorkflow && <AssetEditorPopout onClose={() => setDeletingWorkflow(null)} className="confirm-popout">
      <div className="component-editor-pane">
        <div className="editor-title"><div><span className="eyebrow">Cannot be undone</span><h2>Delete {deletingWorkflow.name}?</h2></div><button className="icon-button" onClick={() => setDeletingWorkflow(null)} aria-label="Cancel delete"><X size={17} /></button></div>
        <p className="editor-description">Its graph and saved record are removed. Staged runs for it are dropped, and any catalyst attached to it becomes unattached.</p>
        {Boolean(nestedIn.length) && <div className="asset-review-banner in-editor"><ShieldCheck size={15} /><div><strong>Nested inside {nestedIn.join(', ')}</strong><span>Those steps will stop resolving until you remove or repoint them.</span></div></div>}
        <div className="editor-actions"><button className="secondary-cta" onClick={() => setDeletingWorkflow(null)}>Keep it</button><button className="primary-cta danger-cta" onClick={() => { onDeleteWorkflow(deletingWorkflow); setDeletingWorkflow(null) }}>Delete workflow</button></div>
      </div>
    </AssetEditorPopout>}
  </>
}

type AssetEditorTarget = { kind: 'component'; id: string } | { kind: 'module'; id: string } | { kind: 'new-component' } | null

function AssetEditorPopout({ children, onClose, className = '' }: { children: React.ReactNode; onClose: () => void; className?: string }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="modal-backdrop asset-popout-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className={`asset-popout ${className}`} role="dialog" aria-modal="true">{children}</div>
  </div>
}

interface DeleteTarget {
  kind: 'component' | 'module' | 'catalyst'
  id: string
  name: string
  detail: string
  usedBy: string[]
  usedByLabel: string
}

function ConfirmDeletePopout({ target, onCancel, onConfirm }: { target: DeleteTarget; onCancel: () => void; onConfirm: () => void }) {
  return <AssetEditorPopout onClose={onCancel} className="confirm-popout">
    <div className="component-editor-pane">
      <div className="editor-title"><div><span className="eyebrow">Cannot be undone</span><h2>Delete {target.name}?</h2></div><button className="icon-button" onClick={onCancel} aria-label="Cancel delete"><X size={17} /></button></div>
      <p className="editor-description">{target.detail}</p>
      {Boolean(target.usedBy.length) && <div className="asset-review-banner in-editor"><ShieldCheck size={15} /><div><strong>{target.usedByLabel} {[...new Set(target.usedBy)].join(', ')}</strong><span>Those steps will stop resolving until you remove or repoint them.</span></div></div>}
      <div className="editor-actions"><button className="secondary-cta" onClick={onCancel}>Keep it</button><button className="primary-cta danger-cta" onClick={onConfirm}>Delete {target.kind}</button></div>
    </div>
  </AssetEditorPopout>
}

function ComponentsPage({ components, modules, onCreate, onCreateModule, onComposeModule, onImportAssets, onDeleteComponent, onDeleteModule, onDeleteCatalyst, componentUsage, moduleUsage, catalystUsage, catalysts, workflows, onCreateCatalyst, onToggleCatalyst }: { components: ComponentTemplate[]; modules: WorkflowModuleDefinition[]; onCreate: (component: ComponentTemplate) => void; onCreateModule: (module: WorkflowModuleDefinition) => void; onComposeModule: (moduleId: string | null) => void; onImportAssets: (assets: ParsedAssets) => void; onDeleteComponent: (componentId: string) => void; onDeleteModule: (moduleId: string) => void; onDeleteCatalyst: (catalystId: string) => void; componentUsage: (componentId: string) => string[]; moduleUsage: (moduleId: string) => string[]; catalystUsage: (catalystId: string) => string[]; catalysts: CatalystDefinition[]; workflows: WorkflowRecord[]; onCreateCatalyst: (catalyst: CatalystDefinition) => void; onToggleCatalyst: (id: string) => void }) {
  const [editor, setEditor] = useState<AssetEditorTarget>(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const reviewCount = [...components, ...modules].filter(needsReview).length
  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'component') onDeleteComponent(deleteTarget.id)
    if (deleteTarget.kind === 'module') onDeleteModule(deleteTarget.id)
    if (deleteTarget.kind === 'catalyst') onDeleteCatalyst(deleteTarget.id)
    setDeleteTarget(null)
    setEditor(null)
  }
  const creating = editor?.kind === 'new-component'
  const selected = editor?.kind === 'component' ? components.find((item) => item.id === editor.id) : undefined
  const selectedModule = editor?.kind === 'module' ? modules.find((item) => item.id === editor.id) : undefined
  const visibleComponents = components.filter((component) => `${component.name} ${component.description} ${component.kind}`.toLowerCase().includes(query.toLowerCase()))
  const [draft, setDraft] = useState({ name: '', description: '', kind: 'agent' as ComponentKind, icon: 'wand', color: 'mint', instruction: '' })
  const [instruction, setInstruction] = useState(selected?.instruction ?? '')
  const [moduleDraft, setModuleDraft] = useState({ name: '', description: '' })

  useEffect(() => { setInstruction(selected?.instruction ?? '') }, [selected?.id, selected?.instruction])
  useEffect(() => { setModuleDraft({ name: selectedModule?.name ?? '', description: selectedModule?.description ?? '' }) }, [selectedModule?.id, selectedModule?.name, selectedModule?.description])

  const create = () => {
    if (!draft.name.trim() || !draft.instruction.trim()) return
    // Why: the id follows the name, so it has to survive a punctuation-only name and must not
    // silently overwrite a component that already owns that slug.
    const id = uniqueId(draft.name, (candidate) => components.some((item) => item.id === candidate), 'component')
    onCreate({ id, name: draft.name.trim(), description: draft.description || 'Custom workspace component.', kind: draft.kind, icon: draft.icon, color: draft.color, version: '0.1.0', tags: ['custom'], instruction: draft.instruction })
    setEditor({ kind: 'component', id })
    setDraft({ name: '', description: '', kind: 'agent', icon: 'wand', color: 'mint', instruction: '' })
  }

  const saveComponent = () => {
    if (!selected) return
    onCreate(clearReview({ ...selected, instruction }))
    setEditor(null)
  }
  const saveModule = () => {
    if (!selectedModule) return
    onCreateModule(clearReview({ ...selectedModule, name: moduleDraft.name.trim() || selectedModule.name, description: moduleDraft.description.trim() || selectedModule.description }))
    setEditor(null)
  }
  const closeEditor = () => setEditor(null)
  const [tab, setTab] = useState<'components' | 'modules' | 'catalysts'>('components')
  const tabs = [
    { id: 'components' as const, label: 'Components', count: components.length, Icon: Blocks },
    { id: 'modules' as const, label: 'Modules', count: modules.length, Icon: Layers3 },
    { id: 'catalysts' as const, label: 'Catalysts', count: catalysts.length, Icon: Zap },
  ]
  const headingCopy = {
    components: { eyebrow: 'Atomic instructions', title: 'Components', description: 'One component does one job. Open one to edit its contract and instructions in place.' },
    modules: { eyebrow: 'Reusable compositions', title: 'Modules', description: 'A module packages several components into one reusable step. Compose its graph on a canvas.' },
    catalysts: { eyebrow: 'Workflow entrypoints', title: 'Catalysts', description: 'Define what may start a workflow. Configure one now and attach it to a workflow whenever you like.' },
  }[tab]
  const openComponent = (id: string) => setEditor({ kind: 'component', id })
  const openModule = (id: string) => setEditor({ kind: 'module', id })

  return <div className="page-wrap"><PageHeading eyebrow="Building blocks" title={headingCopy.title} description={headingCopy.description} action={<div className="page-heading-actions">
      {tab === 'components' && <><AgentSpecButton onDone={(message) => setNotice(message)} /><AssetImportButton onImportAssets={onImportAssets} label="Import assets" onDone={(message) => setNotice(message)} /><button className="primary-cta" onClick={() => setEditor({ kind: 'new-component' })}><Plus size={16} /> New component</button></>}
      {tab === 'modules' && <><AssetImportButton onImportAssets={onImportAssets} label="Import assets" onDone={(message) => setNotice(message)} /><button className="primary-cta" onClick={() => onComposeModule(null)}><Plus size={16} /> New module</button></>}
    </div>} />
    <div className="asset-tabs" role="tablist" aria-label="Building blocks">{tabs.map(({ id, label, count, Icon }) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setNotice(null) }}><Icon size={14} /> {label} <em>{count}</em></button>)}</div>
    {notice && <div className="asset-notice" role="status">{notice}</div>}
    {Boolean(reviewCount) && tab !== 'catalysts' && <div className="asset-review-banner"><ShieldCheck size={15} /><div><strong>{reviewCount} imported asset{reviewCount === 1 ? '' : 's'} awaiting review</strong><span>Open each one, read what it instructs an agent to do, and save it to mark it reviewed.</span></div></div>}
    {tab === 'components' && <section className="asset-catalog-section">
      <label className="wide-search asset-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components" /></label>
      <div className={`component-catalog-grid ${visibleComponents.length ? '' : 'is-empty'}`}>{visibleComponents.length ? visibleComponents.map((component) => <button className={`surface component-catalog-card tone-${component.color} ${needsReview(component) ? 'needs-review' : ''} ${selected?.id === component.id && !selectedModule ? 'selected' : ''}`} key={component.id} onClick={() => openComponent(component.id)}><span className={`component-kind-dot tone-${component.color}`}><ComponentIcon icon={component.icon} /></span><div><div className="module-card-heading"><strong>{component.name}</strong><span>{needsReview(component) ? 'Review' : `v${component.version}`}</span></div><p>{component.description}</p><div className="module-card-contract"><span>{component.kind}</span><i /><span>{component.tags.filter((tag) => tag !== REVIEW_TAG).slice(0, 2).join(' · ') || 'no tags'}</span></div></div><ChevronRight size={15} /></button>) : <div className="table-empty catalog-empty"><Blocks size={20} /><strong>{query ? 'No components match that search' : 'No components yet'}</strong><span>{query ? 'Clear the search to see everything in your workspace.' : 'Create your first component — one clear job an agent can do.'}</span>{!query && <button className="secondary-cta small" onClick={() => setEditor({ kind: 'new-component' })}><Plus size={14} /> New component</button>}</div>}</div>
    </section>}
    {tab === 'modules' && <section className="module-catalog-section">
      <div className={`module-catalog-grid ${modules.length ? '' : 'is-empty'}`}>{modules.length ? modules.map((module) => <article className={`module-catalog-card tone-${module.color} ${needsReview(module) ? 'needs-review' : ''} ${selectedModule?.id === module.id ? 'selected' : ''}`} key={module.id} role="button" tabIndex={0} aria-pressed={selectedModule?.id === module.id} onClick={() => openModule(module.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openModule(module.id) } }}>
        <div className="module-card-top"><span className={`module-card-icon tone-${module.color}`}><Layers3 size={16} /></span><div className="module-card-heading"><strong>{module.name}</strong><span>{needsReview(module) ? 'Review' : `v${module.version}`}</span></div></div>
        <p>{module.description}</p>
        <div className="module-composition" aria-label={`${module.nodes.length} components in ${module.name}`}>{module.nodes.slice(0, 6).map((node, index) => <i key={node.id} style={{ '--module-index': index } as React.CSSProperties} />)}{module.nodes.length > 6 && <em>+{module.nodes.length - 6}</em>}</div>
        <div className="module-card-footer">
          <div className="module-card-contract"><span>{module.nodes.length} components</span><i /><span>{module.edges.length} transitions</span></div>
          <button className="module-card-compose" onClick={(event) => { event.stopPropagation(); onComposeModule(module.id) }} aria-label={`Compose ${module.name}`}><PenLine size={12} /> Compose</button>
        </div>
      </article>) : <div className="table-empty catalog-empty"><Layers3 size={20} /><strong>No modules yet</strong><span>A module packages several components into one reusable step you can drop into any workflow.</span><button className="secondary-cta small" onClick={() => onComposeModule(null)}><Plus size={14} /> New module</button></div>}</div>
    </section>}
    {editor && <AssetEditorPopout onClose={closeEditor} className={creating ? 'wide' : ''}>
      <div className="component-editor-pane">
        {creating ? <>
          <div className="component-create-heading"><div><span className="eyebrow">New reusable instruction</span><h2>Create a component</h2><p>Give the agent one clear job. You can specialize it per workflow later.</p></div><button className="icon-button" onClick={closeEditor} aria-label="Close component creator"><X size={17} /></button></div>
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
                <div className="role-picker">{(['agent', 'judge', 'router', 'tool', 'human'] as ComponentKind[]).map((kind) => <button key={kind} className={draft.kind === kind ? 'selected' : ''} onClick={() => setDraft({ ...draft, kind })}><ComponentIcon icon={iconForKind(kind)} /><span>{kind === 'router' ? 'Decision' : kind}</span></button>)}</div>
                <div className="editor-form"><label><span>Instructions</span><textarea rows={11} value={draft.instruction} onChange={(event) => setDraft({ ...draft, instruction: event.target.value })} placeholder="Review the rendered interface. Focus on keyboard navigation, semantic structure, labels, focus order, and contrast. Return a verdict and prioritized findings…" /></label></div>
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
          <div className="editor-actions component-create-actions"><span>{!draft.name.trim() || !draft.instruction.trim() ? 'Name and instructions are required' : `Will create components/${slugify(draft.name) || 'component'}.md`}</span><button className="secondary-cta" onClick={closeEditor}>Cancel</button><button className="primary-cta" onClick={create} disabled={!draft.name.trim() || !draft.instruction.trim()}>Create component</button></div>
        </> : selectedModule ? <>
          <div className="editor-title"><div><span className="eyebrow">Reusable module</span><h2>{selectedModule.name}</h2></div><div className="editor-title-actions"><span className="status-chip ready">v{selectedModule.version}</span><button className="icon-button" onClick={closeEditor} aria-label="Close module editor"><X size={17} /></button></div></div>
          {needsReview(selectedModule) && <div className="asset-review-banner in-editor"><ShieldCheck size={15} /><div><strong>Imported — not yet reviewed</strong><span>Check the contract and contained components. Saving marks it reviewed.</span></div></div>}
          <div className="editor-form module-contract-editor"><label><span>Module name</span><input value={moduleDraft.name} onChange={(event) => setModuleDraft({ ...moduleDraft, name: event.target.value })} /></label><label><span>Description</span><input value={moduleDraft.description} onChange={(event) => setModuleDraft({ ...moduleDraft, description: event.target.value })} /></label></div>
          <div className="contract-grid"><div><span>Contains</span><strong>{selectedModule.nodes.length} components</strong></div><div><span>Entry points</span><strong>{selectedModule.entryNodeIds.length || 'None'}</strong></div><div><span>Exit points</span><strong>{selectedModule.exitNodeIds.length || 'None'}</strong></div></div>
          <div className="module-editor-graph">{selectedModule.nodes.map((node, index) => <div key={node.id}><em>{index + 1}</em><strong>{node.componentId.replaceAll('-', ' ')}</strong>{index < selectedModule.nodes.length - 1 && <span />}</div>)}</div>
          <div className="source-footer"><div className="source-path"><Layers3 size={14} /> modules/{selectedModule.id}.json</div><span className="module-edit-note">Open <strong>Compose</strong> to edit the components and transitions inside this module on a canvas.</span><button className="secondary-cta delete-action" onClick={() => setDeleteTarget({ kind: 'module', id: selectedModule.id, name: selectedModule.name, detail: 'The module and its internal graph are removed. The components inside it stay in your library.', usedBy: moduleUsage(selectedModule.id), usedByLabel: 'Used by' })}><Trash2 size={13} /> Delete</button><button className="secondary-cta" onClick={() => onComposeModule(selectedModule.id)}><PenLine size={13} /> Compose</button><button className="primary-cta" onClick={saveModule}>Save contract</button></div>
        </> : selected ? <>
          <div className="editor-title"><div><span className="eyebrow">Reusable component</span><h2>{selected.name}</h2></div><div className="editor-title-actions"><span className="status-chip ready">v{selected.version}</span><button className="icon-button" onClick={closeEditor} aria-label="Close component editor"><X size={17} /></button></div></div>
          {needsReview(selected) && <div className="asset-review-banner in-editor"><ShieldCheck size={15} /><div><strong>Imported — not yet reviewed</strong><span>Read the instruction below. Saving marks it reviewed.</span></div></div>}
          <p className="editor-description">{selected.description}</p>
          <div className="contract-grid"><div><span>Role</span><strong>{selected.kind}</strong></div><div><span>Version</span><strong className="plain">v{selected.version}</strong></div><div><span>Review</span><strong>{needsReview(selected) ? 'Pending' : 'Reviewed'}</strong></div></div>
          <div className="editor-form"><label><span>Markdown instructions</span><textarea className="source-editor" rows={18} value={instruction} onChange={(event) => setInstruction(event.target.value)} /></label></div>
          <div className="source-footer"><div className="source-path"><FileCode2 size={14} /> components/{selected.id}.md</div><button className="secondary-cta delete-action" onClick={() => setDeleteTarget({ kind: 'component', id: selected.id, name: selected.name, detail: 'The component and its instructions are removed from this workspace.', usedBy: componentUsage(selected.id), usedByLabel: 'Used by' })}><Trash2 size={13} /> Delete</button><button className="primary-cta" onClick={saveComponent}>Save changes</button></div>
        </> : null}
      </div>
    </AssetEditorPopout>}
    {tab === 'catalysts' && <CatalystsPage embedded catalysts={catalysts} workflows={workflows} onCreate={onCreateCatalyst} onToggle={onToggleCatalyst} onRequestDelete={(catalyst) => setDeleteTarget({ kind: 'catalyst', id: catalyst.id, name: catalyst.name, detail: 'The entrypoint definition is removed. Nothing listens for its event afterwards.', usedBy: catalystUsage(catalyst.id), usedByLabel: 'Bound in' })} />}
    {deleteTarget && <ConfirmDeletePopout target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
  </div>
}

const statusLabel = (status: string) => {
  const text = status.replaceAll('-', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
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
  // Why: renaming a variable onto a name that already exists used to delete the other row's value.
  // Order is preserved too, so the row does not jump to the bottom of the table mid-edit.
  const updateVariable = (oldKey: string, key: string, value: string) => {
    if (key !== oldKey && key in project.variables) return
    const next = Object.fromEntries(variables.map(([name, current]) => name === oldKey ? [key, value] : [name, current]))
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
      <div className="profile-status-line"><span className={`configuration-status ${profile.status === 'ready' ? 'connected' : ''}`}><CircleDot size={12} /> {statusLabel(profile.status)}</span><p>{profile.status === 'scan-requested' ? 'The next connected run will perform a repository sweep before materializing its run specification.' : 'You can set known facts now; the runner treats them as hints until verified.'}</p></div>
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

function TemplatesPage({ templates, workflows, onImportAssets, onCreate, onTogglePublished, onUseTemplate, buildTemplateFromWorkflow }: { templates: WorkflowTemplate[]; workflows: WorkflowRecord[]; onImportAssets: (assets: ParsedAssets) => void; onCreate: (template: WorkflowTemplate) => void; onTogglePublished: (id: string) => void; onUseTemplate: (template: WorkflowTemplate) => void; buildTemplateFromWorkflow: (workflowId: string, draft: { name: string; description: string; level: WorkflowTemplate['level']; published: boolean }) => { template?: WorkflowTemplate; error?: string } }) {
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', description: '', level: 'Guided' as WorkflowTemplate['level'], workflowId: '', published: false })
  const [createError, setCreateError] = useState<string | null>(null)
  const visible = templates.filter((template) => `${template.name} ${template.description} ${template.steps.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const create = () => {
    if (!draft.name.trim() || !draft.description.trim() || !draft.workflowId) return
    const { template, error } = buildTemplateFromWorkflow(draft.workflowId, {
      name: draft.name.trim(), description: draft.description.trim(), level: draft.level, published: draft.published,
    })
    if (!template) {
      setCreateError(error ?? 'That workflow could not be captured as a template.')
      return
    }
    onCreate(template)
    setCreating(false)
    setCreateError(null)
    setDraft({ name: '', description: '', level: 'Guided', workflowId: '', published: false })
  }
  return <div className="page-wrap"><PageHeading eyebrow="Starting points" title="Templates" description="Stable workflow blueprints assembled from reusable modules. Each run gets a project- and objective-specific specification before execution." action={<div className="page-heading-actions"><AssetImportButton onImportAssets={onImportAssets} label="Import template" onDone={(message) => setNotice(message)} /><button className="primary-cta" onClick={() => setCreating(true)}><Plus size={15} /> New template</button></div>} />
    {notice && <div className="asset-notice" role="status">{notice}</div>}
    <section className="template-preflight-note"><Sparkles size={16} /><div><strong>Templates stay reusable; runs become specific.</strong><span>The specification preflight selects optional modules, resolves project commands, and records every adaptation in <code>run-spec.json</code>.</span></div></section>
    {creating && <section className="surface template-create"><div className="editor-title"><div><span className="eyebrow">Save reusable workflow</span><h2>Create template</h2></div><button className="icon-button" onClick={() => setCreating(false)}><X size={16} /></button></div><div className="editor-form two-column"><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="My release workflow" /></label><label><span>Complexity</span><select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value as WorkflowTemplate['level'] })}><option>Guided</option><option>Advanced</option></select></label></div><div className="editor-form"><label><span>Description</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Explain when another user should choose this template." /></label><div className="template-module-field"><span>Capture a saved workflow</span><p>The template stores that workflow's whole graph — steps, transitions, gates, and loop limits — plus the components and modules it uses.</p><div className="template-workflow-picker">{workflows.length ? workflows.map((workflow) => <button key={workflow.id} className={draft.workflowId === workflow.id ? 'selected' : ''} onClick={() => { setDraft({ ...draft, workflowId: workflow.id }); setCreateError(null) }}><span className="template-workflow-mark"><Workflow size={14} /></span><span className="template-workflow-copy"><strong>{workflow.name}</strong><small>{workflow.nodeCount} steps · {workflow.entryMode === 'catalyst' ? 'catalyst entry' : 'manual entry'}</small></span>{draft.workflowId === workflow.id && <CheckCircle2 size={14} />}</button>) : <p className="form-hint">Save a workflow in the builder first — a template is a snapshot of one.</p>}</div></div><label className="publish-setting"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /><span><strong>Publish to community</strong><small>Make this template discoverable after registry review. Keep off for workspace-only use.</small></span></label></div>{createError && <div className="asset-review-banner in-editor"><ShieldCheck size={15} /><div><strong>Cannot capture this workflow</strong><span>{createError}</span></div></div>}<div className="editor-actions"><button className="secondary-cta" onClick={() => setCreating(false)}>Cancel</button><button className="primary-cta" onClick={create} disabled={!draft.name.trim() || !draft.description.trim() || !draft.workflowId}>Create template</button></div></section>}
    <div className="template-toolbar"><label className="wide-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" /></label><span>{templates.filter((template) => template.source === 'user').length} created by you</span></div>
    <div className={`template-grid ${visible.length ? '' : 'is-empty'}`}>{visible.length ? visible.map((template) => <article className="surface template-card" key={template.id}><div className="template-visual"><Workflow size={24} /><span>{template.assets?.workflow ? `${template.assets.workflow.nodes.length} steps · ${template.assets.workflow.edges.length} transitions` : `${template.moduleIds?.length ?? template.steps.length} modules`}</span></div>{Boolean((template.assets?.modules?.length ?? 0) + (template.assets?.components?.length ?? 0)) && <div className="template-assets"><Layers3 size={12} /><span>Brings {[template.assets?.workflow && 'the full graph', template.assets?.modules?.length && `${template.assets.modules.length} module${template.assets.modules.length === 1 ? '' : 's'}`, template.assets?.components?.length && `${template.assets.components.length} component${template.assets.components.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span></div>}<div className="template-badges"><span className={`level-pill ${template.level.toLowerCase()}`}>{template.level}</span><span className={`visibility-pill ${template.published ? 'published' : 'private'}`}>{template.source === 'built-in' ? 'Relay' : template.published ? 'Published' : 'Private'}</span></div><h2>{template.name}</h2><p>{template.description}</p><div className="template-steps">{template.steps.map((step) => <span key={step}>{step}</span>)}</div>{Boolean(template.adaptationRules?.length) && <div className="template-adaptation"><Sparkles size={13} /><span>{template.adaptationRules!.length} optional module {template.adaptationRules!.length === 1 ? 'rule' : 'rules'} resolved during preflight</span></div>}<div className="template-actions"><button className="secondary-cta" onClick={() => onUseTemplate(template)}>{template.assets ? 'Clone into workspace' : 'Use template'} <ArrowRight size={13} /></button>{template.source === 'user' && <button className={`publish-toggle ${template.published ? 'on' : ''}`} onClick={() => onTogglePublished(template.id)} aria-label={`${template.published ? 'Unpublish' : 'Publish'} ${template.name}`}><i /><span>{template.published ? 'Published' : 'Private'}</span></button>}</div></article>) : <div className="table-empty catalog-empty"><Layers3 size={20} /><strong>{query ? 'No templates match that search' : 'No templates yet'}</strong><span>{query ? 'Clear the search to see every template.' : 'Build modules first, then assemble them into a template you can reuse per project.'}</span>{!query && <button className="secondary-cta small" onClick={() => setCreating(true)}><Plus size={14} /> New template</button>}</div>}</div>
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

// Why: an imported or hand-edited catalyst can name a provider these maps do not know. Reading the
// list straight out of the record then crashed the whole page on `.map` of undefined.
const eventsFor = (map: Record<string, { value: string; label: string }[]>, key: string) => map[key] ?? [{ value: key, label: key }]

const catalystSelector = (kind: CatalystKind, settings: typeof defaultCatalystSettings) => {
  if (kind === 'signed-webhook') return `${settings.provider}:${settings.webhookEvent}`
  if (kind === 'connector-event') return `${settings.connector}.${settings.connectorEvent}`
  if (kind === 'cron') return `schedule:${settings.frequency}:${settings.time}:${settings.timezone}`
  return `query:${settings.request}:${settings.scope}`
}

function CatalystsPage({ catalysts, workflows, onCreate, onToggle, onRequestDelete, embedded = false }: { catalysts: CatalystDefinition[]; workflows: WorkflowRecord[]; onCreate: (catalyst: CatalystDefinition) => void; onToggle: (id: string) => void; onRequestDelete?: (catalyst: CatalystDefinition) => void; embedded?: boolean }) {
  const catalystWorkflows = workflows.filter((workflow) => workflow.entryMode === 'catalyst')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', kind: 'connector-event' as CatalystKind, workflowId: '', settings: { ...defaultCatalystSettings } })
  const kind = catalystKinds[draft.kind]
  const openCreator = () => {
    setEditingId(null)
    setDraft({ name: '', kind: 'connector-event', workflowId: '', settings: { ...defaultCatalystSettings } })
    setCreating(true)
  }
  const openEditor = (catalyst: CatalystDefinition) => {
    setEditingId(catalyst.id)
    setDraft({ name: catalyst.name, kind: catalyst.kind, workflowId: catalyst.workflowId ?? '', settings: { ...defaultCatalystSettings, ...catalyst.settings } })
    setCreating(true)
  }
  const create = () => {
    if (!draft.name.trim()) return
    // Why: a catalyst is its own object. It can sit unbound until a workflow attaches it on the canvas.
    const workflow = catalystWorkflows.find((item) => item.id === draft.workflowId)
    const existing = catalysts.find((item) => item.id === editingId)
    const id = editingId ?? uniqueId(draft.name, (candidate) => catalysts.some((item) => item.id === candidate), 'catalyst')
    onCreate({ id, name: draft.name.trim(), kind: draft.kind, workflowId: workflow?.id, workflowName: workflow?.name, selector: catalystSelector(draft.kind, draft.settings), settings: draft.settings, security: kind.security, status: existing?.status ?? 'awaiting-runner', createdAt: existing?.createdAt ?? new Date().toISOString() })
    setCreating(false)
    setEditingId(null)
    setDraft({ name: '', kind: 'connector-event', workflowId: '', settings: { ...defaultCatalystSettings } })
  }

  const updateSetting = (key: keyof typeof defaultCatalystSettings, value: string) => setDraft((current) => ({ ...current, settings: { ...current.settings, [key]: value } }))
  const guidedFields = draft.kind === 'signed-webhook' ? <div className="catalyst-guided-fields">
    <label><span>Service</span><select value={draft.settings.provider} onChange={(event) => { const provider = event.target.value; setDraft((current) => ({ ...current, settings: { ...current.settings, provider, webhookEvent: eventsFor(webhookEvents, provider)[0].value } })) }}><option value="github">GitHub</option><option value="stripe">Stripe</option><option value="custom">Custom service</option></select></label>
    <label><span>Event</span><select value={draft.settings.webhookEvent} onChange={(event) => updateSetting('webhookEvent', event.target.value)}>{eventsFor(webhookEvents, draft.settings.provider).map((event) => <option key={event.value} value={event.value}>{event.label}</option>)}</select></label>
  </div> : draft.kind === 'connector-event' ? <div className="catalyst-guided-fields">
    <label><span>Connector</span><select value={draft.settings.connector} onChange={(event) => { const connector = event.target.value; setDraft((current) => ({ ...current, settings: { ...current.settings, connector, connectorEvent: eventsFor(connectorEvents, connector)[0].value } })) }}><option value="github">GitHub</option><option value="linear">Linear</option><option value="slack">Slack</option></select></label>
    <label><span>Event</span><select value={draft.settings.connectorEvent} onChange={(event) => updateSetting('connectorEvent', event.target.value)}>{eventsFor(connectorEvents, draft.settings.connector).map((event) => <option key={event.value} value={event.value}>{event.label}</option>)}</select></label>
  </div> : draft.kind === 'cron' ? <div className="catalyst-guided-fields">
    <label><span>Repeats</span><select value={draft.settings.frequency} onChange={(event) => updateSetting('frequency', event.target.value)}><option value="hourly">Every hour</option><option value="daily">Every day</option><option value="weekdays">Every weekday</option><option value="weekly">Every week</option></select></label>
    <label><span>Start time</span><input type="time" value={draft.settings.time} onChange={(event) => updateSetting('time', event.target.value)} disabled={draft.settings.frequency === 'hourly'} /></label>
    <label className="full"><span>Timezone</span><select value={draft.settings.timezone} onChange={(event) => updateSetting('timezone', event.target.value)}>{[...new Set([defaultCatalystSettings.timezone, 'UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London'])].map((timezone) => <option key={timezone} value={timezone}>{timezone.replaceAll('_', ' ')}</option>)}</select></label>
  </div> : <div className="catalyst-guided-fields">
    <label><span>Request type</span><select value={draft.settings.request} onChange={(event) => updateSetting('request', event.target.value)}><option value="repository-audit">Repository audit</option><option value="dependency-risk">Dependency risk review</option><option value="release-readiness">Release readiness check</option><option value="custom-objective">Schema-limited objective</option></select></label>
    <label><span>Who may request it</span><select value={draft.settings.scope} onChange={(event) => updateSetting('scope', event.target.value)}><option value="workspace">Workspace members</option><option value="service-account">Approved service account</option><option value="runner-token">Runner token holders</option></select></label>
  </div>

  const content = <>{embedded
    ? <div className="asset-panel-heading"><p>Relay verifies the event at the receiver, records its provenance, then creates a normal auditable run.</p><button className="primary-cta" onClick={openCreator}><Plus size={15} /> New catalyst</button></div>
    : <PageHeading eyebrow="Workflow entrypoints" title="Catalysts" description="Define what may start a workflow. Relay verifies the event at the receiver, records its provenance, then creates a normal auditable run." action={<button className="primary-cta" onClick={openCreator}><Plus size={15} /> New catalyst</button>} />}
    {creating && <AssetEditorPopout onClose={() => { setCreating(false); setEditingId(null) }}><section className="catalyst-create"><div className="editor-title"><div><span className="eyebrow">Secure entrypoint</span><h2>{editingId ? 'Edit catalyst' : 'Configure a catalyst'}</h2></div><button className="icon-button" onClick={() => { setCreating(false); setEditingId(null) }}><X size={16} /></button></div><div className="catalyst-create-grid"><div className="catalyst-kind-grid">{(Object.entries(catalystKinds) as [CatalystKind, typeof kind][]).map(([id, option]) => { const Icon = option.Icon; return <button className={draft.kind === id ? 'selected' : ''} key={id} onClick={() => setDraft({ ...draft, kind: id })}><Icon size={17} /><strong>{option.label}</strong><small>{option.detail}</small></button> })}</div><div className="editor-form catalyst-fields"><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="PR quality check" /></label><label><span>Attached workflow <em>Optional</em></span><select value={draft.workflowId} onChange={(event) => setDraft({ ...draft, workflowId: event.target.value })}><option value="">Not attached yet</option>{catalystWorkflows.map((workflow) => <option value={workflow.id} key={workflow.id}>{workflow.name}</option>)}</select><small>{catalystWorkflows.length ? 'You can also attach it from a Catalyst node in the builder.' : 'No catalyst workflow yet — configure this now and attach it from a Catalyst node in the builder later.'}</small></label>{guidedFields}<div className="catalyst-security"><ShieldCheck size={16} /><div><strong>{kind.security === 'hmac' ? 'HMAC signature required' : kind.security === 'connector-oauth' ? 'Connector authorization required' : 'Runner token required'}</strong><span>Secrets are referenced by name and resolved by the receiver. They are never stored in workflow JSON.</span></div></div><div className="editor-actions">{editingId && onRequestDelete && <button className="secondary-cta delete-action" onClick={() => { const existing = catalysts.find((item) => item.id === editingId); if (existing) { setCreating(false); setEditingId(null); onRequestDelete(existing) } }}><Trash2 size={13} /> Delete</button>}<button className="secondary-cta" onClick={() => { setCreating(false); setEditingId(null) }}>Cancel</button><button className="primary-cta" onClick={create} disabled={!draft.name.trim()}>Save catalyst</button></div></div></div></section></AssetEditorPopout>}
    {catalysts.length ? <div className="catalyst-list">{catalysts.map((catalyst) => { const option = catalystKinds[catalyst.kind]; const Icon = option.Icon; return <article className="surface catalyst-card" key={catalyst.id} role="button" tabIndex={0} onClick={() => openEditor(catalyst)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor(catalyst) } }}><span className="catalyst-card-icon"><Icon size={18} /></span><div className="catalyst-card-main"><div><span className="eyebrow">{option.label}</span><h2>{catalyst.name}</h2></div><p>{describeCatalyst(catalyst)}</p><div className="catalyst-route"><span className={catalyst.workflowId ? '' : 'unbound'}><Zap size={12} /> {catalyst.workflowName ?? 'Not attached'}</span><ArrowRight size={12} /><span><ShieldCheck size={12} /> {catalyst.security}</span></div></div><div className="catalyst-card-state"><span className={`status-chip ${catalyst.status === 'paused' ? 'draft' : 'ready'}`}><i /> {catalyst.status === 'paused' ? 'Paused' : 'Awaiting receiver'}</span><button className="secondary-cta" onClick={(event) => { event.stopPropagation(); onToggle(catalyst.id) }}>{catalyst.status === 'paused' ? 'Enable' : 'Pause'}</button></div></article> })}</div> : <section className="surface catalyst-empty"><span><Webhook size={22} /></span><h2>No catalysts configured</h2><p>Create a signed hook, connector subscription, schedule, or secure query. Nothing listens publicly until a Relay receiver is connected and authorized.</p><button className="secondary-cta" onClick={openCreator}>Configure first catalyst <ArrowRight size={13} /></button></section>}
    <section className="catalyst-boundary"><ShieldCheck size={17} /><div><strong>Receiver boundary</strong><span>The website authors catalyst definitions. A local daemon or hosted Relay receiver performs signature checks, connector authentication, replay protection, rate limits, and idempotency before creating a run.</span></div></section>
  </>
  return embedded ? <section className="embedded-catalysts">{content}</section> : <div className="page-wrap">{content}</div>
}

function RunsPage({ onNavigate, stagedRuns, onUpdateStagedRuns, workflows, board, onUpdateBoard, catalysts }: { onNavigate: (page: AppPage) => void; stagedRuns: PendingRun[]; onUpdateStagedRuns: (runs: PendingRun[]) => void; workflows: WorkflowRecord[]; board: RunMonitorBoard; onUpdateBoard: (update: (board: RunMonitorBoard) => RunMonitorBoard) => void; catalysts: CatalystDefinition[] }) {
  return <div className="run-board-page"><RunBoard board={board} workflows={workflows} stagedRuns={stagedRuns} catalysts={catalysts} onUpdateStagedRuns={onUpdateStagedRuns} onChange={onUpdateBoard} onOpenBuilder={() => onNavigate('builder')} onOpenCatalysts={() => onNavigate('catalysts')} /></div>
}
