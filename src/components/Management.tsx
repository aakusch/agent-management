import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  Blocks,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  FileCode2,
  FolderGit2,
  Gauge,
  GitBranch,
  Home,
  Layers3,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  X,
} from 'lucide-react'
import type { ComponentKind, ComponentTemplate, ProjectContext } from '../types/workflow'

export type AppPage = 'dashboard' | 'builder' | 'workflows' | 'components' | 'projects' | 'templates' | 'runs'

interface ManagementProps {
  page: Exclude<AppPage, 'builder'>
  onNavigate: (page: AppPage) => void
  project: ProjectContext
  onUpdateProject: (project: ProjectContext) => void
  components: ComponentTemplate[]
  onCreateComponent: (component: ComponentTemplate) => void
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
          {page === 'dashboard' && <Dashboard onNavigate={onNavigate} project={project} components={components} />}
          {page === 'workflows' && <WorkflowsPage onNavigate={onNavigate} />}
          {page === 'components' && <ComponentsPage components={components} onCreate={onCreateComponent} />}
          {page === 'projects' && <ProjectsPage project={project} onUpdate={onUpdateProject} />}
          {page === 'templates' && <TemplatesPage onNavigate={onNavigate} />}
          {page === 'runs' && <RunsPage onNavigate={onNavigate} />}
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

function Dashboard({ onNavigate, project, components }: { onNavigate: (page: AppPage) => void; project: ProjectContext; components: ComponentTemplate[] }) {
  return (
    <div className="page-wrap">
      <PageHeading
        eyebrow="Good morning"
        title="Build reliable work, visually."
        description="Start with a proven workflow, adjust it for your project, then hand one complete assignment to your agent."
        action={<button className="primary-cta" onClick={() => onNavigate('builder')}><Plus size={16} /> Create workflow</button>}
      />

      <div className="metrics-grid">
        <Metric label="Workflows" value="3" detail="1 ready to run" icon={Workflow} />
        <Metric label="Components" value={String(components.length)} detail="2 customized" icon={Blocks} />
        <Metric label="Successful runs" value="94%" detail="Last 30 days" icon={CheckCircle2} />
        <Metric label="Time saved" value="6.4h" detail="This week" icon={Clock3} />
      </div>

      <div className="dashboard-grid">
        <section className="surface getting-started-card">
          <div className="surface-heading">
            <div><span className="eyebrow">Guided setup</span><h2>Your first dependable workflow</h2></div>
            <span className="progress-pill">2 of 4</span>
          </div>
          <div className="setup-steps">
            <SetupStep done number="1" title="Connect a project" detail={`${project.name} · ${project.branch}`} onClick={() => onNavigate('projects')} />
            <SetupStep done number="2" title="Choose a workflow" detail="UI quality loop" onClick={() => onNavigate('workflows')} />
            <SetupStep number="3" title="Review the instructions" detail="See exactly what each agent receives" onClick={() => onNavigate('components')} />
            <SetupStep number="4" title="Export the assignment" detail="A single .relay.json file for your driver agent" onClick={() => onNavigate('builder')} />
          </div>
        </section>

        <section className="surface current-workflow-card">
          <div className="surface-heading"><div><span className="eyebrow">Ready workflow</span><h2>UI quality loop</h2></div><span className="status-chip ready"><CircleDot size={12} /> Ready</span></div>
          <div className="mini-flow" aria-label="Implement then review, revise, and ship">
            <span className="tone-mint"><Code2 size={15} /></span><i />
            <span className="tone-blue"><GitBranch size={15} /></span><i />
            <span className="tone-coral"><Gauge size={15} /></span><i />
            <span className="tone-cyan"><CheckCircle2 size={15} /></span>
          </div>
          <p>Implementation fans out to code and visual review. Failed checks return with feedback; passing work becomes a PR-ready handoff.</p>
          <div className="card-actions">
            <button className="secondary-cta" onClick={() => onNavigate('workflows')}>View details</button>
            <button className="primary-cta small" onClick={() => onNavigate('builder')}><Play size={13} /> Open</button>
          </div>
        </section>
      </div>

      <section className="surface activity-surface">
        <div className="surface-heading"><div><span className="eyebrow">Recent activity</span><h2>Runs and changes</h2></div><button className="text-button" onClick={() => onNavigate('runs')}>View all <ArrowRight size={13} /></button></div>
        <ActivityRow icon={CheckCircle2} tone="success" title="UI quality loop completed" detail="1 revision · 12.1k tokens · 18s" time="12m" />
        <ActivityRow icon={Blocks} tone="blue" title="Visual judge updated to v1.1" detail="Spacing tolerance clarified" time="2h" />
        <ActivityRow icon={FolderGit2} tone="violet" title={`${project.name} connected`} detail={project.root} time="1d" />
      </section>
    </div>
  )
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: React.ComponentType<{ size?: number }>; }) {
  return <div className="metric-card"><span><Icon size={16} /></span><strong>{value}</strong><h3>{label}</h3><p>{detail}</p></div>
}

function SetupStep({ done, number, title, detail, onClick }: { done?: boolean; number: string; title: string; detail: string; onClick: () => void }) {
  return <button className="setup-step" onClick={onClick}><span className={done ? 'done' : ''}>{done ? <CheckCircle2 size={16} /> : number}</span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight size={16} /></button>
}

function ActivityRow({ icon: Icon, tone, title, detail, time }: { icon: React.ComponentType<{ size?: number }>; tone: string; title: string; detail: string; time: string }) {
  return <div className="activity-row"><span className={`activity-icon ${tone}`}><Icon size={15} /></span><div><strong>{title}</strong><small>{detail}</small></div><time>{time}</time></div>
}

function WorkflowsPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const [query, setQuery] = useState('')
  const workflows = [
    { name: 'UI quality loop', summary: 'Build, parallel review, revise, and hand off.', nodes: 5, updated: '12 min ago', status: 'Ready' },
    { name: 'Bug fix lane', summary: 'Reproduce, patch, test, and review a defect.', nodes: 6, updated: 'Yesterday', status: 'Draft' },
    { name: 'Release confidence', summary: 'Run checks and collect human approval before publish.', nodes: 8, updated: '3 days ago', status: 'Ready' },
  ]
  const visibleWorkflows = workflows.filter((workflow) => `${workflow.name} ${workflow.summary}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page-wrap"><PageHeading eyebrow="Library" title="Workflows" description="Saved ways of working. Reuse one as-is or customize a copy for a project." action={<button className="primary-cta" onClick={() => onNavigate('builder')}><Plus size={16} /> New workflow</button>} />
    <div className="filter-row"><label className="wide-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows" /></label><button className="filter-button" onClick={() => setQuery('')}>All projects <ChevronRight size={13} /></button></div>
    <div className="workflow-table surface">
      {visibleWorkflows.map((workflow) => <button className="workflow-row" key={workflow.name} onClick={() => onNavigate('builder')}>
        <span className="row-icon"><Workflow size={17} /></span><div className="row-main"><strong>{workflow.name}</strong><small>{workflow.summary}</small></div><span>{workflow.nodes} steps</span><span>{workflow.updated}</span><span className={`status-chip ${workflow.status.toLowerCase()}`}>{workflow.status}</span><ChevronRight size={15} />
      </button>)}
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
  const updateVariable = (oldKey: string, key: string, value: string) => {
    const next = { ...project.variables }
    delete next[oldKey]
    next[key] = value
    onUpdate({ ...project, variables: next })
  }
  return <div className="page-wrap"><PageHeading eyebrow="Context and permissions" title="Projects" description="Teach workflows about a repository once. Every component receives only the context and capabilities it needs." />
    <div className="project-grid"><section className="surface project-card"><div className="surface-heading"><div><span className="eyebrow">Connected project</span><h2>{project.name}</h2></div><span className="status-chip ready"><CircleDot size={12} /> Connected</span></div><div className="editor-form"><label><span>Display name</span><input value={project.name} onChange={(event) => onUpdate({ ...project, name: event.target.value })} /></label><label><span>Repository root</span><input value={project.root} onChange={(event) => onUpdate({ ...project, root: event.target.value })} /></label><label><span>Working branch</span><input value={project.branch} onChange={(event) => onUpdate({ ...project, branch: event.target.value })} /></label></div></section>
      <section className="surface policy-card"><div className="surface-heading"><div><span className="eyebrow">Driver policy</span><h2>Capabilities</h2></div><Settings2 size={17} /></div><PolicyRow label="Spawn configured agents" value="Allowed" /><PolicyRow label="Shell access" value="Project only" /><PolicyRow label="Network access" value="Ask first" /><PolicyRow label="Publish changes" value="Ask first" /></section>
    </div>
    <section className="surface variables-surface"><div className="surface-heading"><div><span className="eyebrow">Reusable values</span><h2>Project variables</h2></div><button className="secondary-cta" onClick={() => onUpdate({ ...project, variables: { ...project.variables, 'new.variable': '' } })}><Plus size={14} /> Add variable</button></div><p>These fill matching placeholders such as <code>{'{{preview.url}}'}</code> before an assignment is handed to the driver.</p>{variables.map(([key, value]) => <div className="variable-row" key={key}><input value={key} onChange={(event) => updateVariable(key, event.target.value, value)} /><input value={value} onChange={(event) => updateVariable(key, key, event.target.value)} /></div>)}</section>
  </div>
}

function PolicyRow({ label, value }: { label: string; value: string }) { return <div className="policy-row"><span>{label}</span><strong>{value}</strong></div> }

function TemplatesPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const templates = [
    { name: 'UI quality loop', level: 'Guided', description: 'Build an interface, review code and visuals in parallel, then revise or ship.', steps: ['Implement', 'Code review', 'Visual judge', 'Quality gate', 'Handoff'] },
    { name: 'Bug fix lane', level: 'Guided', description: 'Reproduce a defect, make a focused fix, run tests, and request review.', steps: ['Reproduce', 'Fix', 'Test', 'Review'] },
    { name: 'Continuous issue triage', level: 'Advanced', description: 'Watch an inbox, classify new issues, route urgent work, and checkpoint until stopped.', steps: ['Watch', 'Classify', 'Route', 'Checkpoint'] },
  ]
  return <div className="page-wrap"><PageHeading eyebrow="Starting points" title="Templates" description="Understandable defaults for common jobs. Every template can be opened, inspected, and changed." />
    <div className="template-grid">{templates.map((template, index) => <article className="surface template-card" key={template.name}><div className="template-visual"><Workflow size={24} /><span>{template.steps.length} steps</span></div><span className={`level-pill ${template.level.toLowerCase()}`}>{template.level}</span><h2>{template.name}</h2><p>{template.description}</p><div className="template-steps">{template.steps.map((step) => <span key={step}>{step}</span>)}</div><button className="secondary-cta" onClick={() => onNavigate('builder')}>{index === 0 ? 'Use template' : 'Open in builder'} <ArrowRight size={13} /></button></article>)}</div>
  </div>
}

function RunsPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  return <div className="page-wrap"><PageHeading eyebrow="Execution history" title="Runs" description="Follow what happened, why the workflow chose each path, and what every agent produced." action={<button className="primary-cta" onClick={() => onNavigate('builder')}><Play size={14} /> New run</button>} />
    <section className="surface control-room">
      <div className="surface-heading"><div><span className="eyebrow">Live control room</span><h2>UI quality loop · run 185</h2></div><span className="live-pill"><i /> Live</span></div>
      <div className="control-room-grid">
        <div className="live-graph-panel">
          <div className="live-graph">
            <div className="live-node passed"><CheckCircle2 size={14} /><span><strong>Implement</strong><small>complete</small></span></div>
            <div className="live-connector passed" />
            <div className="live-fanout"><div className="live-node passed"><CheckCircle2 size={14} /><span><strong>Code review</strong><small>passed</small></span></div><div className="live-node running"><Activity size={14} /><span><strong>Visual judge</strong><small>running</small></span></div></div>
            <div className="live-connector running" />
            <div className="live-node waiting"><Clock3 size={14} /><span><strong>Quality gate</strong><small>waiting</small></span></div>
          </div>
          <div className="run-budget"><span>Iteration 1 of 3</span><span>7.8k / 40k tokens</span><span>00:12 / 60:00</span></div>
        </div>
        <div className="agent-lanes">
          <AgentLane name="Driver" role="Orchestrator" status="Watching 2 agents" detail="Waiting for visual-judge verdict before evaluating the quality gate." tone="mint" icon={Workflow} />
          <AgentLane name="Code review" role="Agent 01" status="Complete" detail="2 non-blocking findings · verdict: pass" tone="blue" icon={Code2} />
          <AgentLane name="Visual judge" role="Agent 02" status="Inspecting mobile" detail="Browser: comparing 390 × 844 screenshot" tone="violet" icon={TerminalSquare} running />
        </div>
      </div>
    </section>
    <section className="surface run-hero"><div><span className="status-chip ready"><CheckCircle2 size={12} /> Completed</span><h2>UI quality loop</h2><p>Completed after one visual revision. All required checks passed.</p></div><div className="run-stats"><div><strong>18.2s</strong><span>Duration</span></div><div><strong>12.1k</strong><span>Tokens</span></div><div><strong>1</strong><span>Revision</span></div></div></section>
    <section className="surface timeline-surface"><div className="surface-heading"><div><span className="eyebrow">Event trace</span><h2>What happened</h2></div><span className="event-log-label">events.jsonl</span></div><div className="timeline"><TimelineItem title="Implement UI completed" detail="8 files changed · patch artifact saved" time="0:05" /><TimelineItem title="Reviews ran in parallel" detail="Code passed · Visual requested changes" time="0:09" /><TimelineItem title="Quality gate chose revise" detail="Matched edge: route == revise" time="0:10" warning /><TimelineItem title="Visual feedback resolved" detail="2 corrections applied · recheck passed" time="0:16" /><TimelineItem title="Ship summary completed" detail="Pull request handoff saved" time="0:18" /></div></section>
  </div>
}

function AgentLane({ name, role, status, detail, tone, icon: Icon, running }: { name: string; role: string; status: string; detail: string; tone: string; icon: React.ComponentType<{ size?: number }>; running?: boolean }) {
  return <article className={`agent-lane ${running ? 'is-running' : ''}`}><span className={`agent-avatar tone-${tone}`}><Icon size={15} /></span><div className="agent-lane-main"><div><strong>{name}</strong><small>{role}</small></div><p>{detail}</p><span className="agent-status">{running && <i />} {status}</span></div><ChevronRight className="agent-lane-chevron" size={15} /></article>
}

function TimelineItem({ title, detail, time, warning }: { title: string; detail: string; time: string; warning?: boolean }) { return <div className={`timeline-item ${warning ? 'warning' : ''}`}><span><CheckCircle2 size={14} /></span><div><strong>{title}</strong><small>{detail}</small></div><time>{time}</time></div> }
