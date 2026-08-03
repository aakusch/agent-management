import { useState } from 'react'
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
import type { ComponentKind, ComponentTemplate, ProjectContext, ReasoningEffort, RelayTool } from '../types/workflow'
import type { CatalystDefinition, CatalystKind, PendingRun, RunMonitorBoard, WorkflowRecord, WorkflowTemplate } from '../types/catalog'
import { RunBoard } from './RunBoard'

export type AppPage = 'dashboard' | 'builder' | 'workflows' | 'components' | 'projects' | 'templates' | 'catalysts' | 'runs'

interface ManagementProps {
  page: Exclude<AppPage, 'builder'>
  onNavigate: (page: AppPage) => void
  project: ProjectContext
  onUpdateProject: (project: ProjectContext) => void
  components: ComponentTemplate[]
  onCreateComponent: (component: ComponentTemplate) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  workflows: WorkflowRecord[]
  templates: WorkflowTemplate[]
  onCreateTemplate: (template: WorkflowTemplate) => void
  onToggleTemplatePublished: (id: string) => void
  onUseTemplate: (template: WorkflowTemplate) => void
  pendingRun: PendingRun | null
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

const navItems = [
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'components', label: 'Components', icon: Blocks },
  { id: 'projects', label: 'Configure', icon: Settings2 },
  { id: 'templates', label: 'Templates', icon: Layers3 },
  { id: 'catalysts', label: 'Catalysts', icon: Zap },
  { id: 'runs', label: 'Runs', icon: Activity },
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
  onCreateComponent,
  theme,
  onToggleTheme,
  workflows,
  templates,
  onCreateTemplate,
  onToggleTemplatePublished,
  onUseTemplate,
  pendingRun,
  monitorBoard,
  onUpdateMonitorBoard,
  catalysts,
  onCreateCatalyst,
  onToggleCatalyst,
}: ManagementProps) {
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
          <button className="subtle-button" onClick={() => onNavigate('projects')}><Settings2 size={15} /> {project.root ? project.name : 'Configure project'}</button>
          <button className="icon-button theme-toggle" onClick={onToggleTheme} aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="run-button" onClick={() => onNavigate('builder')}><Plus size={14} /> Open builder</button>
        </div>
      </header>
      <div className="management-body">
        <aside className="management-nav">
          <nav>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>
                  <Icon size={16} /> {item.label}
                </button>
              )
            })}
          </nav>
          <div className="nav-help">
            <ShieldCheck size={17} />
            <strong>Safe by default</strong>
            <span>Every loop, tool, and publish action has an explicit limit or permission.</span>
          </div>
        </aside>
        <section className="management-content">
          {page === 'dashboard' && <Dashboard onNavigate={onNavigate} project={project} components={components} workflows={workflows} />}
          {page === 'workflows' && <WorkflowsPage onNavigate={onNavigate} workflows={workflows} />}
          {page === 'components' && <ComponentsPage components={components} onCreate={onCreateComponent} />}
          {page === 'projects' && <ProjectsPage project={project} onUpdate={onUpdateProject} />}
          {page === 'templates' && <TemplatesPage templates={templates} onCreate={onCreateTemplate} onTogglePublished={onToggleTemplatePublished} onUseTemplate={onUseTemplate} />}
          {page === 'catalysts' && <CatalystsPage catalysts={catalysts} workflows={workflows} onCreate={onCreateCatalyst} onToggle={onToggleCatalyst} />}
          {page === 'runs' && <RunsPage onNavigate={onNavigate} pendingRun={pendingRun} workflows={workflows} board={monitorBoard} onUpdateBoard={onUpdateMonitorBoard} />}
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

function WorkflowRows({ workflows, onOpen }: { workflows: WorkflowRecord[]; onOpen: (workflow: WorkflowRecord) => void }) {
  if (workflows.length === 0) return <div className="table-empty"><Workflow size={20} /><strong>No workflows yet</strong><span>Create one in the builder or start from a template.</span></div>
  return <div className="workflow-rows">{workflows.map((workflow) => <button className="workflow-row" key={workflow.id} onClick={() => onOpen(workflow)}>
    <span className="row-icon"><Workflow size={17} /></span><div className="row-main"><strong>{workflow.name}</strong><small>{workflow.description}</small></div><span>{workflow.nodeCount} steps</span><span>{workflow.projectName ?? 'Any project'}</span><span className={`status-chip ${workflow.status}`}>{workflow.status}</span><ChevronRight size={15} />
  </button>)}</div>
}

function WorkflowsPage({ onNavigate, workflows }: { onNavigate: (page: AppPage) => void; workflows: WorkflowRecord[] }) {
  const [query, setQuery] = useState('')
  const visibleWorkflows = workflows.filter((workflow) => `${workflow.name} ${workflow.description} ${workflow.projectName ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page-wrap"><PageHeading eyebrow="Library" title="Workflows" description="Saved ways of working. Reuse one as-is or customize a copy for a project." action={<button className="primary-cta" onClick={() => onNavigate('builder')}><Plus size={16} /> New workflow</button>} />
    <div className="filter-row"><label className="wide-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows" /></label><button className="filter-button" onClick={() => setQuery('')}>All projects <ChevronRight size={13} /></button></div>
    <div className="workflow-table surface">
      <WorkflowRows workflows={visibleWorkflows} onOpen={() => onNavigate('builder')} />
    </div>
  </div>
}

function ComponentsPage({ components, onCreate }: { components: ComponentTemplate[]; onCreate: (component: ComponentTemplate) => void }) {
  const [selectedId, setSelectedId] = useState(components[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const selected = components.find((item) => item.id === selectedId) ?? components[0]
  const visibleComponents = components.filter((component) => `${component.name} ${component.description} ${component.kind}`.toLowerCase().includes(query.toLowerCase()))
  const [draft, setDraft] = useState({ name: '', description: '', kind: 'agent' as ComponentKind, icon: 'wand', color: 'mint', instruction: '', inputs: '', outputs: '' })

  const create = () => {
    if (!draft.name.trim() || !draft.instruction.trim()) return
    const id = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    onCreate({ id, name: draft.name, description: draft.description || 'Custom workspace component.', kind: draft.kind, icon: draft.icon, color: draft.color, version: '0.1.0', tags: ['custom'], inputs: draft.inputs.split(',').map((value) => value.trim()).filter(Boolean), outputs: draft.outputs.split(',').map((value) => value.trim()).filter(Boolean), instruction: draft.instruction })
    setSelectedId(id)
    setCreating(false)
    setDraft({ name: '', description: '', kind: 'agent', icon: 'wand', color: 'mint', instruction: '', inputs: '', outputs: '' })
  }

  return <div className="page-wrap"><PageHeading eyebrow="Instruction library" title="Components" description="Configure reusable agent roles in plain language. Advanced contracts stay available when you need them." action={<button className="primary-cta" onClick={() => setCreating(true)}><Plus size={16} /> New component</button>} />
    <div className="component-manager surface">
      <div className="component-list-pane"><label className="wide-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components" /></label>{visibleComponents.map((component) => <button key={component.id} className={selected?.id === component.id ? 'active' : ''} onClick={() => { setSelectedId(component.id); setCreating(false) }}><span className={`component-kind-dot tone-${component.color}`}><ComponentIcon icon={component.icon} /></span><div><strong>{component.name}</strong><small>{component.kind} · v{component.version}</small></div><ChevronRight size={14} /></button>)}</div>
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
        </> : selected ? <>
          <div className="editor-title"><div><span className="eyebrow">Reusable component</span><h2>{selected.name}</h2></div><span className="status-chip ready">v{selected.version}</span></div>
          <p className="editor-description">{selected.description}</p>
          <div className="contract-grid"><div><span>Role</span><strong>{selected.kind}</strong></div><div><span>Inputs</span><strong>{selected.inputs.length || 'None'}</strong></div><div><span>Outputs</span><strong>{selected.outputs.length || 'None'}</strong></div></div>
          <div className="editor-form"><label><span>Markdown instructions</span><textarea className="source-editor" rows={18} value={selected.instruction} readOnly /></label></div>
          <div className="source-footer"><div className="source-path"><FileCode2 size={14} /> components/{selected.id}.md</div><button className="secondary-cta" onClick={() => {
            const customized = { ...selected, id: `${selected.id}-custom`, name: `${selected.name} custom`, version: '0.1.0', tags: [...selected.tags, 'custom'] }
            onCreate(customized)
            setSelectedId(customized.id)
          }}>Customize a copy</button></div>
        </> : null}
      </div>
    </div>
  </div>
}

function ProjectsPage({ project, onUpdate }: { project: ProjectContext; onUpdate: (project: ProjectContext) => void }) {
  const variables = Object.entries(project.variables)
  const connected = Boolean(project.root)
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

function TemplatesPage({ templates, onCreate, onTogglePublished, onUseTemplate }: { templates: WorkflowTemplate[]; onCreate: (template: WorkflowTemplate) => void; onTogglePublished: (id: string) => void; onUseTemplate: (template: WorkflowTemplate) => void }) {
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState({ name: '', description: '', level: 'Guided' as WorkflowTemplate['level'], steps: '', published: false })
  const visible = templates.filter((template) => `${template.name} ${template.description} ${template.steps.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const create = () => {
    if (!draft.name.trim() || !draft.description.trim()) return
    const id = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    onCreate({ id, name: draft.name.trim(), description: draft.description.trim(), level: draft.level, steps: draft.steps.split(',').map((step) => step.trim()).filter(Boolean), componentIds: ['implement-ui', 'code-review', 'visual-judge', 'decision-gate', 'summarize'], source: 'user', published: draft.published, createdAt: new Date().toISOString() })
    setCreating(false)
    setDraft({ name: '', description: '', level: 'Guided', steps: '', published: false })
  }
  return <div className="page-wrap"><PageHeading eyebrow="Starting points" title="Templates" description="Reusable workflow structures from Relay, your workspace, and eventually the shared community registry." action={<button className="primary-cta" onClick={() => setCreating(true)}><Plus size={15} /> New template</button>} />
    {creating && <section className="surface template-create"><div className="editor-title"><div><span className="eyebrow">Save reusable workflow</span><h2>Create template</h2></div><button className="icon-button" onClick={() => setCreating(false)}><X size={16} /></button></div><div className="editor-form two-column"><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="My release workflow" /></label><label><span>Complexity</span><select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value as WorkflowTemplate['level'] })}><option>Guided</option><option>Advanced</option></select></label></div><div className="editor-form"><label><span>Description</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Explain when another user should choose this template." /></label><label><span>Step labels, comma separated</span><input value={draft.steps} onChange={(event) => setDraft({ ...draft, steps: event.target.value })} placeholder="Plan, Implement, Review, Handoff" /></label><label className="publish-setting"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /><span><strong>Publish to community</strong><small>Make this template discoverable after registry review. Keep off for workspace-only use.</small></span></label></div><div className="editor-actions"><button className="secondary-cta" onClick={() => setCreating(false)}>Cancel</button><button className="primary-cta" onClick={create}>Create template</button></div></section>}
    <div className="template-toolbar"><label className="wide-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" /></label><span>{templates.filter((template) => template.source === 'user').length} created by you</span></div>
    <div className="template-grid">{visible.map((template) => <article className="surface template-card" key={template.id}><div className="template-visual"><Workflow size={24} /><span>{template.steps.length} steps</span></div><div className="template-badges"><span className={`level-pill ${template.level.toLowerCase()}`}>{template.level}</span><span className={`visibility-pill ${template.published ? 'published' : 'private'}`}>{template.source === 'built-in' ? 'Relay' : template.published ? 'Published' : 'Private'}</span></div><h2>{template.name}</h2><p>{template.description}</p><div className="template-steps">{template.steps.map((step) => <span key={step}>{step}</span>)}</div><div className="template-actions"><button className="secondary-cta" onClick={() => onUseTemplate(template)}>Use template <ArrowRight size={13} /></button>{template.source === 'user' && <button className={`publish-toggle ${template.published ? 'on' : ''}`} onClick={() => onTogglePublished(template.id)} aria-label={`${template.published ? 'Unpublish' : 'Publish'} ${template.name}`}><i /><span>{template.published ? 'Published' : 'Private'}</span></button>}</div></article>)}</div>
  </div>
}

const catalystKinds: Record<CatalystKind, { label: string; detail: string; placeholder: string; security: CatalystDefinition['security']; Icon: typeof Zap }> = {
  'signed-webhook': { label: 'Signed webhook', detail: 'Receive an HMAC-verified event from an external system.', placeholder: 'POST /hooks/github-pr', security: 'hmac', Icon: Webhook },
  'connector-event': { label: 'Connector event', detail: 'Subscribe through an authorized GitHub, Slack, or issue connector.', placeholder: 'github.pull_request.opened', security: 'connector-oauth', Icon: Cable },
  cron: { label: 'Schedule', detail: 'Ask the connected runner to start on a recurring schedule.', placeholder: '0 9 * * 1-5', security: 'runner-token', Icon: Clock3 },
  'secure-query': { label: 'Secure query', detail: 'Expose an authenticated, schema-limited workflow request.', placeholder: 'query: dependency-risk', security: 'runner-token', Icon: KeyRound },
}

function CatalystsPage({ catalysts, workflows, onCreate, onToggle }: { catalysts: CatalystDefinition[]; workflows: WorkflowRecord[]; onCreate: (catalyst: CatalystDefinition) => void; onToggle: (id: string) => void }) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: '', kind: 'connector-event' as CatalystKind, workflowId: workflows[0]?.id ?? '', selector: '' })
  const kind = catalystKinds[draft.kind]
  const create = () => {
    const workflow = workflows.find((item) => item.id === draft.workflowId)
    if (!workflow || !draft.name.trim() || !draft.selector.trim()) return
    const id = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    onCreate({ id, name: draft.name.trim(), kind: draft.kind, workflowId: workflow.id, workflowName: workflow.name, selector: draft.selector.trim(), security: kind.security, status: 'awaiting-runner', createdAt: new Date().toISOString() })
    setCreating(false)
    setDraft({ name: '', kind: 'connector-event', workflowId: workflows[0]?.id ?? '', selector: '' })
  }

  return <div className="page-wrap"><PageHeading eyebrow="Workflow entrypoints" title="Catalysts" description="Define what may start a workflow. Relay verifies the event at the receiver, records its provenance, then creates a normal auditable run." action={<button className="primary-cta" onClick={() => setCreating(true)}><Plus size={15} /> New catalyst</button>} />
    {creating && <section className="surface catalyst-create"><div className="editor-title"><div><span className="eyebrow">Secure entrypoint</span><h2>Configure a catalyst</h2></div><button className="icon-button" onClick={() => setCreating(false)}><X size={16} /></button></div><div className="catalyst-create-grid"><div className="catalyst-kind-grid">{(Object.entries(catalystKinds) as [CatalystKind, typeof kind][]).map(([id, option]) => { const Icon = option.Icon; return <button className={draft.kind === id ? 'selected' : ''} key={id} onClick={() => setDraft({ ...draft, kind: id })}><Icon size={17} /><strong>{option.label}</strong><small>{option.detail}</small></button> })}</div><div className="editor-form catalyst-fields"><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="PR quality check" /></label><label><span>Workflow</span><select value={draft.workflowId} onChange={(event) => setDraft({ ...draft, workflowId: event.target.value })}>{workflows.map((workflow) => <option value={workflow.id} key={workflow.id}>{workflow.name}</option>)}</select></label><label><span>Event, schedule, or query selector</span><input className="source-editor" value={draft.selector} onChange={(event) => setDraft({ ...draft, selector: event.target.value })} placeholder={kind.placeholder} /></label><div className="catalyst-security"><ShieldCheck size={16} /><div><strong>{kind.security === 'hmac' ? 'HMAC signature required' : kind.security === 'connector-oauth' ? 'Connector authorization required' : 'Runner token required'}</strong><span>Secrets are referenced by name and resolved by the receiver. They are never stored in workflow JSON.</span></div></div><div className="editor-actions"><button className="secondary-cta" onClick={() => setCreating(false)}>Cancel</button><button className="primary-cta" onClick={create} disabled={!draft.name.trim() || !draft.selector.trim() || !draft.workflowId}>Save catalyst</button></div></div></div></section>}
    {catalysts.length ? <div className="catalyst-list">{catalysts.map((catalyst) => { const option = catalystKinds[catalyst.kind]; const Icon = option.Icon; return <article className="surface catalyst-card" key={catalyst.id}><span className="catalyst-card-icon"><Icon size={18} /></span><div className="catalyst-card-main"><div><span className="eyebrow">{option.label}</span><h2>{catalyst.name}</h2></div><p>{catalyst.selector}</p><div className="catalyst-route"><span><Zap size={12} /> {catalyst.workflowName}</span><ArrowRight size={12} /><span><ShieldCheck size={12} /> {catalyst.security}</span></div></div><div className="catalyst-card-state"><span className={`status-chip ${catalyst.status === 'paused' ? 'draft' : 'ready'}`}><i /> {catalyst.status === 'paused' ? 'Paused' : 'Awaiting receiver'}</span><button className="secondary-cta" onClick={() => onToggle(catalyst.id)}>{catalyst.status === 'paused' ? 'Enable' : 'Pause'}</button></div></article> })}</div> : <section className="surface catalyst-empty"><span><Webhook size={22} /></span><h2>No catalysts configured</h2><p>Create a signed hook, connector subscription, schedule, or secure query. Nothing listens publicly until a Relay receiver is connected and authorized.</p><button className="secondary-cta" onClick={() => setCreating(true)}>Configure first catalyst <ArrowRight size={13} /></button></section>}
    <section className="catalyst-boundary"><ShieldCheck size={17} /><div><strong>Receiver boundary</strong><span>The website authors catalyst definitions. A local daemon or hosted Relay receiver performs signature checks, connector authentication, replay protection, rate limits, and idempotency before creating a run.</span></div></section>
  </div>
}

function RunsPage({ onNavigate, pendingRun, workflows, board, onUpdateBoard }: { onNavigate: (page: AppPage) => void; pendingRun: PendingRun | null; workflows: WorkflowRecord[]; board: RunMonitorBoard; onUpdateBoard: (board: RunMonitorBoard) => void }) {
  return <div className="run-board-page"><RunBoard board={board} workflows={workflows} pendingRun={pendingRun} onChange={onUpdateBoard} onOpenBuilder={() => onNavigate('builder')} /></div>
}
