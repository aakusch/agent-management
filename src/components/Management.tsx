import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  Blocks,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FileCode2,
  FolderGit2,
  Home,
  Layers3,
  Moon,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  TerminalSquare,
  Workflow,
  X,
} from 'lucide-react'
import type { ComponentKind, ComponentTemplate, ProjectContext } from '../types/workflow'
import type { PendingRun, WorkflowRecord, WorkflowTemplate } from '../types/catalog'

export type AppPage = 'dashboard' | 'builder' | 'workflows' | 'components' | 'projects' | 'templates' | 'runs'

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
  pendingRun: PendingRun | null
}

const pageLabels: Record<Exclude<AppPage, 'builder'>, string> = {
  dashboard: 'Dashboard',
  workflows: 'Workflows',
  components: 'Components',
  projects: 'Projects',
  templates: 'Templates',
  runs: 'Runs',
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'components', label: 'Components', icon: Blocks },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'templates', label: 'Templates', icon: Layers3 },
  { id: 'runs', label: 'Runs', icon: Activity },
] as const

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
  pendingRun,
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
          <button className="subtle-button" onClick={() => onNavigate('projects')}><FolderGit2 size={15} /> {project.name}</button>
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
          {page === 'templates' && <TemplatesPage onNavigate={onNavigate} templates={templates} onCreate={onCreateTemplate} onTogglePublished={onToggleTemplatePublished} />}
          {page === 'runs' && <RunsPage onNavigate={onNavigate} pendingRun={pendingRun} />}
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
  const [draft, setDraft] = useState({ name: '', description: '', kind: 'agent' as ComponentKind, instruction: '', inputs: '', outputs: '' })

  const create = () => {
    if (!draft.name.trim() || !draft.instruction.trim()) return
    const id = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    onCreate({ id, name: draft.name, description: draft.description || 'Custom workspace component.', kind: draft.kind, icon: 'wand', color: 'mint', version: '0.1.0', tags: ['custom'], inputs: draft.inputs.split(',').map((value) => value.trim()).filter(Boolean), outputs: draft.outputs.split(',').map((value) => value.trim()).filter(Boolean), instruction: draft.instruction })
    setSelectedId(id)
    setCreating(false)
    setDraft({ name: '', description: '', kind: 'agent', instruction: '', inputs: '', outputs: '' })
  }

  return <div className="page-wrap"><PageHeading eyebrow="Instruction library" title="Components" description="Configure reusable agent roles in plain language. Advanced contracts stay available when you need them." action={<button className="primary-cta" onClick={() => setCreating(true)}><Plus size={16} /> New component</button>} />
    <div className="component-manager surface">
      <div className="component-list-pane"><label className="wide-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components" /></label>{visibleComponents.map((component) => <button key={component.id} className={selected?.id === component.id ? 'active' : ''} onClick={() => { setSelectedId(component.id); setCreating(false) }}><span className={`component-kind-dot tone-${component.color}`}><Bot size={14} /></span><div><strong>{component.name}</strong><small>{component.kind} · v{component.version}</small></div><ChevronRight size={14} /></button>)}</div>
      <div className="component-editor-pane">
        {creating ? <>
          <div className="editor-title"><div><span className="eyebrow">New reusable instruction</span><h2>Create component</h2></div><button className="icon-button" onClick={() => setCreating(false)}><X size={17} /></button></div>
          <div className="friendly-note"><Sparkles size={16} /><div><strong>Start with the job, not the settings.</strong><span>Describe what this agent should do and what a good result looks like. The technical contract can evolve later.</span></div></div>
          <div className="editor-form two-column"><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Accessibility reviewer" /></label><label><span>Role</span><select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as ComponentKind })}><option value="agent">Agent</option><option value="judge">Judge</option><option value="router">Decision</option><option value="tool">Tool</option><option value="human">Human</option></select></label></div>
          <div className="editor-form"><label><span>What does it do?</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Checks the interface for accessibility issues." /></label><label><span>Instructions</span><textarea rows={10} value={draft.instruction} onChange={(event) => setDraft({ ...draft, instruction: event.target.value })} placeholder="Review the rendered interface. Focus on keyboard navigation…" /></label><details><summary>Advanced input and output contract</summary><div className="two-column"><label><span>Inputs, comma separated</span><input value={draft.inputs} onChange={(event) => setDraft({ ...draft, inputs: event.target.value })} placeholder="preview_url, brief" /></label><label><span>Outputs</span><input value={draft.outputs} onChange={(event) => setDraft({ ...draft, outputs: event.target.value })} placeholder="verdict, findings" /></label></div></details></div>
          <div className="editor-actions"><button className="secondary-cta" onClick={() => setCreating(false)}>Cancel</button><button className="primary-cta" onClick={create}>Create component</button></div>
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
  const updateVariable = (oldKey: string, key: string, value: string) => {
    const next = { ...project.variables }
    delete next[oldKey]
    next[key] = value
    onUpdate({ ...project, variables: next })
  }
  return <div className="page-wrap"><PageHeading eyebrow="Context and permissions" title="Projects" description="Teach workflows about a repository once. Every component receives only the context and capabilities it needs." />
    <div className="project-grid"><section className="surface project-card"><div className="surface-heading"><div><span className="eyebrow">Local project</span><h2>{connected ? project.name : 'Connect a repository'}</h2></div><span className={`status-chip ${connected ? 'ready' : 'draft'}`}><CircleDot size={12} /> {connected ? 'Connected' : 'Not connected'}</span></div><div className="editor-form"><label><span>Display name</span><input value={project.name === 'No project selected' ? '' : project.name} onChange={(event) => onUpdate({ ...project, name: event.target.value || 'No project selected' })} placeholder="Remember" /></label><label><span>Repository root</span><input value={project.root} onChange={(event) => onUpdate({ ...project, root: event.target.value })} placeholder="/Users/you/Desktop/Repos/project" /></label><label><span>Working branch</span><input value={project.branch} onChange={(event) => onUpdate({ ...project, branch: event.target.value })} placeholder="main" /></label></div></section>
      <section className="surface policy-card"><div className="surface-heading"><div><span className="eyebrow">Driver policy</span><h2>Capabilities</h2></div><Settings2 size={17} /></div><PolicyRow label="Spawn configured agents" value="Allowed" /><PolicyRow label="Shell access" value="Project only" /><PolicyRow label="Network access" value="Ask first" /><PolicyRow label="Publish changes" value="Ask first" /></section>
    </div>
    <section className="surface variables-surface"><div className="surface-heading"><div><span className="eyebrow">Reusable values</span><h2>Project variables</h2></div><button className="secondary-cta" onClick={() => onUpdate({ ...project, variables: { ...project.variables, 'new.variable': '' } })}><Plus size={14} /> Add variable</button></div><p>These fill matching placeholders such as <code>{'{{preview.url}}'}</code> before an assignment is handed to the driver.</p>{variables.map(([key, value]) => <div className="variable-row" key={key}><input value={key} onChange={(event) => updateVariable(key, event.target.value, value)} /><input value={value} onChange={(event) => updateVariable(key, key, event.target.value)} /></div>)}</section>
  </div>
}

function PolicyRow({ label, value }: { label: string; value: string }) { return <div className="policy-row"><span>{label}</span><strong>{value}</strong></div> }

function TemplatesPage({ onNavigate, templates, onCreate, onTogglePublished }: { onNavigate: (page: AppPage) => void; templates: WorkflowTemplate[]; onCreate: (template: WorkflowTemplate) => void; onTogglePublished: (id: string) => void }) {
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
    <div className="template-grid">{visible.map((template) => <article className="surface template-card" key={template.id}><div className="template-visual"><Workflow size={24} /><span>{template.steps.length} steps</span></div><div className="template-badges"><span className={`level-pill ${template.level.toLowerCase()}`}>{template.level}</span><span className={`visibility-pill ${template.published ? 'published' : 'private'}`}>{template.source === 'built-in' ? 'Relay' : template.published ? 'Published' : 'Private'}</span></div><h2>{template.name}</h2><p>{template.description}</p><div className="template-steps">{template.steps.map((step) => <span key={step}>{step}</span>)}</div><div className="template-actions"><button className="secondary-cta" onClick={() => onNavigate('builder')}>Use template <ArrowRight size={13} /></button>{template.source === 'user' && <button className={`publish-toggle ${template.published ? 'on' : ''}`} onClick={() => onTogglePublished(template.id)} aria-label={`${template.published ? 'Unpublish' : 'Publish'} ${template.name}`}><i /><span>{template.published ? 'Published' : 'Private'}</span></button>}</div></article>)}</div>
  </div>
}

function RunsPage({ onNavigate, pendingRun }: { onNavigate: (page: AppPage) => void; pendingRun: PendingRun | null }) {
  return <div className="page-wrap"><PageHeading eyebrow="Execution" title="Runs" description="Live driver and agent activity will appear here when a Relay CLI is connected." action={<button className="primary-cta" onClick={() => onNavigate('builder')}><Play size={14} /> Prepare run</button>} />
    {pendingRun ? <section className="surface pending-run"><span className="pending-run-icon"><TerminalSquare size={22} /></span><div className="pending-run-copy"><span className="eyebrow">Waiting for local runner</span><h2>{pendingRun.workflowName}</h2><p>{pendingRun.configuration.task}</p><div className="pending-run-meta"><span>{pendingRun.configuration.autonomy}</span>{pendingRun.projectName && <span>{pendingRun.projectName}</span>}<span>{pendingRun.configuration.execution}</span></div></div><div className="connect-command"><span>Run from the project directory</span><code>relay connect</code><small>The website will attach this prepared run after the CLI is paired.</small></div></section> : <section className="surface runs-empty"><span><Activity size={23} /></span><h2>No runs yet</h2><p>Prepare a workflow run, then connect the Relay CLI from the target project. Real agent status, events, and artifacts will appear here.</p><button className="secondary-cta" onClick={() => onNavigate('builder')}>Open workflow builder <ArrowRight size={13} /></button></section>}
    <section className="surface runner-explanation"><div><span className="eyebrow">Live tracking</span><h2>What appears after connection</h2></div><div className="runner-feature-grid"><span><Workflow size={16} /><strong>Graph state</strong><small>Ready, running, waiting, and completed nodes.</small></span><span><TerminalSquare size={16} /><strong>Agent lanes</strong><small>Current instruction, tool activity, and heartbeat.</small></span><span><FileCode2 size={16} /><strong>Artifacts</strong><small>Patches, reports, screenshots, and approvals.</small></span></div></section>
  </div>
}
