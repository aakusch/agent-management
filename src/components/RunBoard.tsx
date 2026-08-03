import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleStop,
  Code2,
  Copy,
  FileJson2,
  FolderGit2,
  KeyRound,
  Link2,
  LoaderCircle,
  Pause,
  Play,
  Radio,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Trash2,
  WifiOff,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import type { CatalystDefinition, PendingRun, RelayRunEvent, RunMonitorBoard, RunMonitorStatus, RunMonitorTile, WorkflowRecord } from '../types/catalog'

interface RunBoardProps {
  board: RunMonitorBoard
  workflows: WorkflowRecord[]
  stagedRuns: PendingRun[]
  catalysts: CatalystDefinition[]
  onUpdateStagedRuns: (runs: PendingRun[]) => void
  onChange: (board: RunMonitorBoard) => void
  onOpenBuilder: () => void
  onOpenCatalysts: () => void
}

const statusCopy: Record<RunMonitorStatus, { label: string; detail: string }> = {
  'not-started': { label: 'Not started', detail: 'This monitor is not attached to an execution.' },
  'waiting-runner': { label: 'Waiting for runner', detail: 'Attach the local Relay runner to begin streaming.' },
  running: { label: 'Running', detail: 'Events are streaming from the connected runner.' },
  blocked: { label: 'Needs attention', detail: 'The driver is waiting for a decision.' },
  completed: { label: 'Completed', detail: 'The workflow reached a terminal state.' },
}

const eventTypes = [
  'run.created', 'run.started', 'run.paused', 'run.resumed', 'run.completed', 'run.failed', 'run.cancelled',
  'node.ready', 'node.started', 'node.output', 'node.completed', 'node.failed',
  'agent.spawned', 'agent.heartbeat', 'agent.tool.started', 'agent.tool.completed', 'agent.stopped',
  'route.selected', 'loop.iterated', 'loop.exhausted', 'artifact.created', 'approval.requested',
  'approval.resolved', 'budget.warning', 'policy.denied',
  'specification.started', 'specification.completed', 'specification.failed',
]

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function WorkflowRunGraph({ tile, events = [], expanded = false }: { tile: RunMonitorTile; events?: RelayRunEvent[]; expanded?: boolean }) {
  const fallback = ['Prepare', 'Implement', 'Review', 'Verify', 'Handoff']
  const supplied = tile.steps.every((step) => /^Step \d+$/.test(step)) ? [] : tile.steps
  const steps = supplied.length >= 5 ? supplied : [...supplied, ...fallback].slice(0, 5)
  const activeNodeId = [...events].reverse().find((event) => event.nodeId && ['node.started', 'node.output', 'agent.spawned', 'agent.tool.started'].includes(event.type))?.nodeId
  const completedIds = new Set(events.filter((event) => event.type === 'node.completed' && event.nodeId).map((event) => event.nodeId))
  const stateFor = (label: string, index: number) => {
    const labelSlug = slug(label)
    const matches = (id?: string) => Boolean(id && (slug(id) === labelSlug || slug(id).includes(labelSlug.split('-')[0])))
    if (tile.status === 'completed' || [...completedIds].some(matches)) return 'complete'
    if (matches(activeNodeId) || (tile.status === 'running' && index === 0 && !activeNodeId)) return 'active'
    if (tile.status === 'blocked' && index === 0) return 'attention'
    return ''
  }

  if (tile.graph?.nodes.length) {
    const xs = tile.graph.nodes.map((node) => node.x)
    const ys = tile.graph.nodes.map((node) => node.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const point = (node: (typeof tile.graph.nodes)[number]) => ({
      x: 4 + ((node.x - minX) / Math.max(maxX - minX, 1)) * 77,
      y: 10 + ((node.y - minY) / Math.max(maxY - minY, 1)) * 66,
    })
    const nodeById = new Map(tile.graph.nodes.map((node) => [node.id, node]))
    const stateForNode = (id: string) => {
      if (tile.status === 'completed' || completedIds.has(id)) return 'complete'
      if (activeNodeId === id || slug(activeNodeId ?? '') === slug(id)) return 'active'
      if (tile.status === 'blocked' && activeNodeId === id) return 'attention'
      return ''
    }
    return <div className={`mini-run-graph snapshot ${expanded ? 'expanded' : ''} status-${tile.status}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {tile.graph.edges.map((item) => {
          const source = nodeById.get(item.source)
          const target = nodeById.get(item.target)
          if (!source || !target) return null
          const from = point(source)
          const to = point(target)
          const backwards = to.x <= from.x
          return <path key={item.id} className={backwards || item.tone === 'danger' ? 'return-path' : ''} d={`M ${from.x + 15} ${from.y + 7} C ${backwards ? from.x + 20 : (from.x + to.x) / 2} ${from.y + 7}, ${backwards ? to.x - 5 : (from.x + to.x) / 2} ${to.y + 7}, ${to.x} ${to.y + 7}`} />
        })}
      </svg>
      {tile.graph.nodes.map((node) => {
        const position = point(node)
        return <div className={`monitor-node snapshot-node ${stateForNode(node.id)}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} key={node.id}><i /><strong>{node.label}</strong><small>{node.kind}</small></div>
      })}
    </div>
  }

  return (
    <div className={`mini-run-graph ${expanded ? 'expanded' : ''} status-${tile.status}`}>
      <svg viewBox="0 0 720 190" preserveAspectRatio="none" aria-hidden="true">
        <path d="M120 95 C165 95 170 44 215 44" />
        <path d="M120 95 C165 95 170 146 215 146" />
        <path d="M335 44 C380 44 385 95 430 95" />
        <path d="M335 146 C380 146 385 95 430 95" />
        <path d="M550 95 L605 95" />
        <path className="return-path" d="M490 132 C490 178 85 178 85 127" />
      </svg>
      <div className={`monitor-node start ${stateFor(steps[0], 0)}`}><i /><strong>{steps[0]}</strong><small>Start</small></div>
      <div className="monitor-parallel">
        <div className={`monitor-node ${stateFor(steps[1], 1)}`}><i /><strong>{steps[1]}</strong><small>Agent</small></div>
        <div className={`monitor-node ${stateFor(steps[2], 2)}`}><i /><strong>{steps[2]}</strong><small>Judge</small></div>
      </div>
      <div className={`monitor-node gate ${stateFor(steps[3], 3)}`}><i /><strong>{steps[3]}</strong><small>Gate</small></div>
      <div className={`monitor-node end ${stateFor(steps[4], 4)}`}><i /><strong>{steps[4]}</strong><small>Output</small></div>
    </div>
  )
}

function AgentAuthoringPanel({ onClose, onOpenBuilder }: { onClose: () => void; onOpenBuilder: () => void }) {
  const command = 'npm run relay -- create .relay/workflows/my-workflow/workflow.json --name "My workflow"'
  const prompt = `Create or update a Relay workflow in .relay/workflows/<name>/workflow.json. Use the relay-workflow CLI to add nodes and transitions, then run relay-workflow validate. Keep component instructions in .relay/components/*.md. Do not hand-edit canvas coordinates; the CLI assigns layout. Import the validated workflow into Relay for visual review.`
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return (
    <section className="agent-authoring-panel">
      <button className="panel-close" onClick={onClose} aria-label="Close agent authoring guide"><X size={15} /></button>
      <div className="authoring-icon"><Bot size={18} /></div>
      <div className="authoring-copy">
        <span className="eyebrow">Agent-native authoring</span>
        <h2>Let an agent construct the workflow as files</h2>
        <p>The graph is canonical JSON, components are Markdown, and the CLI performs safe graph edits and validation. Relay remains the visual review and run surface.</p>
        <div className="authoring-files">
          <code><FileJson2 size={13} /> .relay/workflows/&lt;name&gt;/workflow.json</code>
          <code><Code2 size={13} /> .relay/components/*.md</code>
          <code><TerminalSquare size={13} /> {command}</code>
        </div>
      </div>
      <div className="authoring-actions">
        <button onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy agent assignment'}</button>
        <button className="primary-cta small" onClick={onOpenBuilder}>Open builder <ArrowRight size={13} /></button>
      </div>
    </section>
  )
}

function ExpandedRun({ tile, onBack, onPatch }: { tile: RunMonitorTile; onBack: () => void; onPatch: (patch: Partial<RunMonitorTile>) => void }) {
  const [observerUrl, setObserverUrl] = useState(tile.observerUrl ?? '')
  const [token, setToken] = useState('')
  const [connection, setConnection] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle')
  const [streamUrl, setStreamUrl] = useState('')
  const [events, setEvents] = useState<RelayRunEvent[]>([])
  const [filter, setFilter] = useState<'all' | 'agent' | 'tools' | 'decisions'>('all')
  const [tokenOpen, setTokenOpen] = useState(false)
  const [commandCopied, setCommandCopied] = useState(false)
  const eventEnd = useRef<HTMLDivElement>(null)
  const patchRef = useRef(onPatch)
  patchRef.current = onPatch

  useEffect(() => {
    if (!streamUrl) return
    setConnection('connecting')
    const source = new EventSource(streamUrl)
    const receive = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as RelayRunEvent
        if (!event || typeof event.type !== 'string' || typeof event.seq !== 'number') return
        setEvents((current) => [...current.filter((item) => item.seq !== event.seq), event].sort((a, b) => a.seq - b.seq).slice(-500))
        setConnection('live')
        if (['run.started', 'run.resumed'].includes(event.type)) patchRef.current({ status: 'running', updatedAt: event.time })
        if (['approval.requested', 'run.paused', 'loop.exhausted'].includes(event.type)) patchRef.current({ status: 'blocked', updatedAt: event.time })
        if (event.type === 'run.completed') patchRef.current({ status: 'completed', updatedAt: event.time })
        if (['run.failed', 'run.cancelled'].includes(event.type)) patchRef.current({ status: 'blocked', updatedAt: event.time })
      } catch { /* Ignore malformed runner events and keep the stream open. */ }
    }
    source.onopen = () => setConnection('live')
    source.onmessage = receive
    eventTypes.forEach((type) => source.addEventListener(type, receive as EventListener))
    source.onerror = () => setConnection('error')
    return () => source.close()
  }, [streamUrl])

  useEffect(() => {
    if (events.length) eventEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [events])

  const connect = () => {
    const base = observerUrl.trim().replace(/\/$/, '')
    if (!base) return
    try {
      const endpoint = base.includes('/events') ? base : `${base}/v1/runs/${encodeURIComponent(tile.id)}/events`
      const url = new URL(endpoint)
      if (token.trim()) url.searchParams.set('token', token.trim())
      onPatch({ observerUrl: base, status: tile.status === 'not-started' ? 'waiting-runner' : tile.status })
      setStreamUrl(url.toString())
    } catch { setConnection('error') }
  }

  const disconnect = () => {
    setStreamUrl('')
    setConnection('idle')
  }

  const pasteObserver = async () => {
    try {
      const value = await navigator.clipboard.readText()
      if (value.trim()) setObserverUrl(value.trim())
    } catch { /* Clipboard access remains an optional convenience. */ }
  }

  const copyConnectCommand = async () => {
    try {
      await navigator.clipboard.writeText(`relay connect --run ${tile.id}`)
      setCommandCopied(true)
      window.setTimeout(() => setCommandCopied(false), 1800)
    } catch { /* The command remains selectable if clipboard permission is unavailable. */ }
  }

  const sendControl = async (control: 'pause' | 'resume' | 'cancel') => {
    const observer = observerUrl.trim().replace(/\/$/, '')
    if (!observer) return
    try {
      const parsed = new URL(observer)
      const runPath = parsed.pathname.indexOf('/v1/runs/')
      const base = runPath >= 0 ? `${parsed.origin}${parsed.pathname.slice(0, runPath)}` : observer
      const response = await fetch(`${base}/v1/runs/${encodeURIComponent(tile.id)}/${control}`, {
        method: 'POST',
        headers: token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {},
      })
      if (!response.ok) throw new Error()
    } catch { setConnection('error') }
  }

  const visibleEvents = events.filter((event) => {
    if (filter === 'agent') return event.type.startsWith('agent.') || event.type.startsWith('node.')
    if (filter === 'tools') return event.type.includes('.tool.') || event.type === 'artifact.created'
    if (filter === 'decisions') return event.type.startsWith('route.') || event.type.startsWith('loop.') || event.type.startsWith('approval.') || event.type.startsWith('policy.')
    return true
  })
  const copy = statusCopy[tile.status]
  const liveAgentIds = new Set<string>()
  events.forEach((event) => {
    if (!event.agentId) return
    if (event.type === 'agent.stopped') liveAgentIds.delete(event.agentId)
    else liveAgentIds.add(event.agentId)
  })
  const activeAgents = liveAgentIds.size
  const latestNode = [...events].reverse().find((event) => event.nodeId)?.nodeId
  const connectionLabel = connection === 'live' ? 'Connected' : connection === 'connecting' ? 'Connecting' : connection === 'error' ? 'Unavailable' : 'Disconnected'

  return (
    <div className="run-detail">
      <div className="run-detail-bar">
        <button className="run-back" onClick={onBack}><ArrowLeft size={14} /> All running workflows</button>
        <span className={`run-status-pill ${tile.status}`}><i /> {copy.label}</span>
        <div className="run-operator-controls">
          <button onClick={() => void sendControl(tile.status === 'blocked' ? 'resume' : 'pause')} disabled={!streamUrl || tile.status === 'completed'}>{tile.status === 'blocked' ? <Play size={13} /> : <Pause size={13} />} {tile.status === 'blocked' ? 'Resume' : 'Pause'}</button>
          <button className="danger" onClick={() => void sendControl('cancel')} disabled={!streamUrl || tile.status === 'completed'}><CircleStop size={13} /> Cancel</button>
        </div>
      </div>

      <header className="run-detail-heading">
        <div><span className="eyebrow">Run {tile.id}</span><h1>{tile.workflowName}</h1><p>{tile.objective || 'No objective was supplied for this run.'}</p></div>
        <div className="run-detail-meta"><span><FolderGit2 size={13} /> {tile.projectName || 'No project'}</span><span><Radio size={13} /> {connection === 'live' ? 'Runner connected' : connection === 'connecting' ? 'Connecting…' : connection === 'error' ? 'Runner unavailable' : 'Runner disconnected'}</span></div>
      </header>

      <section className="run-spec-phase"><span><Sparkles size={15} /></span><div><strong>Phase 0 · Specification preflight</strong><p>The driver first verifies project facts and writes the immutable <code>run-spec.json</code> accompaniment. The reusable graph begins only after that artifact is accepted.</p></div><em>{events.some((event) => event.type === 'specification.completed') ? 'Complete' : events.some((event) => event.type === 'specification.started') ? 'Running' : 'Pending'}</em></section>

      <div className={`runner-connect state-${connection}`}>
        <div className="runner-connect-status">
          <span className="runner-status-icon">{connection === 'connecting' ? <LoaderCircle className="spin" size={16} /> : connection === 'error' ? <WifiOff size={16} /> : <Server size={16} />}</span>
          <div><strong>Runner connection</strong><span>{connection === 'live' ? 'Secure event stream attached to this run.' : connection === 'error' ? 'The observer did not respond. Check the URL and local CLI.' : 'Paste the observer or signed stream URL printed by the Relay CLI.'}</span></div>
          <em><i /> {connectionLabel}</em>
        </div>
        <div className="runner-connect-form">
          <label className="observer-field"><span><Link2 size={11} /> Observer URL</span><div><input value={observerUrl} onChange={(event) => setObserverUrl(event.target.value)} placeholder="http://127.0.0.1:4317 or signed /events URL" aria-label="Runner observer URL" /><button type="button" onClick={() => void pasteObserver()}><Copy size={12} /> Paste</button></div></label>
          {tokenOpen && <label className="token-field"><span><KeyRound size={11} /> Capability token</span><input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Kept only in this browser tab" type="password" aria-label="Runner capability token" /></label>}
          <button className={`token-toggle ${tokenOpen ? 'active' : ''}`} onClick={() => setTokenOpen((current) => !current)}><KeyRound size={12} /> {tokenOpen ? 'Hide token' : 'Add token'}</button>
          {streamUrl ? <button className="disconnect-runner" onClick={disconnect}><WifiOff size={13} /> Disconnect</button> : <button className="primary-cta small connect-runner" onClick={connect} disabled={!observerUrl.trim()}><Radio size={13} /> Connect runner</button>}
        </div>
      </div>

      <div className="run-split-view">
        <section className="run-graph-panel">
          <div className="run-panel-heading"><div><span className="eyebrow">Workflow state</span><h2>Execution graph</h2></div><span>{tile.graph?.nodes.length ?? Math.min(tile.steps.length, 5)} components</span></div>
          <WorkflowRunGraph tile={tile} events={events} expanded />
          <div className="run-graph-legend"><span><i className="active" /> Running</span><span><i className="complete" /> Complete</span><span><i className="attention" /> Attention</span></div>
        </section>

        <section className="agent-stream-panel">
          <div className="run-panel-heading"><div><span className="eyebrow">Agent stream</span><h2>Live activity</h2></div><span>{events.length} events</span></div>
          <div className="stream-status-rail">
            <span><i className={`connection-${connection}`} /> <small>Driver</small><strong>{connectionLabel}</strong></span>
            <span><i /> <small>Agents</small><strong>{activeAgents || '—'}</strong></span>
            <span><i /> <small>Current node</small><strong>{latestNode || '—'}</strong></span>
          </div>
          <div className="stream-filters">
            {(['all', 'agent', 'tools', 'decisions'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}
          </div>
          <div className="agent-event-stream" role="log" aria-live="polite">
            {visibleEvents.length ? visibleEvents.map((event) => <article className={`agent-event event-${event.type.split('.')[0]}`} key={`${event.seq}-${event.type}`}>
              <time>{formatTime(event.time)}</time>
              <span className="event-seq">#{event.seq}</span>
              <div><strong>{event.type}</strong><p>{event.payload?.summary || event.payload?.command || event.payload?.tool || event.payload?.route || 'State updated'}</p><small>{[event.agentId, event.nodeId && `node: ${event.nodeId}`, event.attempt && `attempt ${event.attempt}`].filter(Boolean).join(' · ')}</small></div>
            </article>) : events.length ? <div className="stream-empty compact"><Search size={20} /><strong>No events in this filter</strong><span>Choose another activity filter to return to the full event stream.</span></div> : <div className={`stream-empty connection-${connection}`}>
              <span className="stream-empty-icon">{connection === 'connecting' ? <LoaderCircle className="spin" size={21} /> : connection === 'error' ? <WifiOff size={21} /> : connection === 'live' ? <Radio size={21} /> : <TerminalSquare size={21} />}</span>
              <strong>{connection === 'connecting' ? 'Opening the event stream' : connection === 'error' ? 'Couldn’t reach this runner' : connection === 'live' ? 'Connected—waiting for activity' : 'Attach the local runner'}</strong>
              <span>{connection === 'error' ? 'Confirm the Relay CLI is running and use the exact observer URL it printed.' : connection === 'live' ? 'The connection is healthy. Agent and tool events will appear here as execution begins.' : 'Run the connection command in the project terminal, then paste its observer URL above.'}</span>
              {connection === 'idle' && <div className="stream-setup">
                <div><em>1</em><span><strong>Start the driver</strong><small>Use the same run identifier shown here.</small></span></div>
                <button onClick={() => void copyConnectCommand()}><code>relay connect --run {tile.id}</code><span>{commandCopied ? <Check size={12} /> : <Copy size={12} />} {commandCopied ? 'Copied' : 'Copy'}</span></button>
                <div><em>2</em><span><strong>Paste its observer URL</strong><small>Tokens remain in this tab and are never saved.</small></span></div>
                <div><em>3</em><span><strong>Connect the runner</strong><small>The append-only SSE feed becomes this activity view.</small></span></div>
              </div>}
              {connection === 'error' && <button className="stream-retry" onClick={connect} disabled={!observerUrl.trim()}><Radio size={12} /> Try again</button>}
              <div className="stream-trust"><ShieldCheck size={12} /> The UI derives state only from signed runner events.</div>
            </div>}
            <div ref={eventEnd} />
          </div>
        </section>
      </div>
    </div>
  )
}

export function RunBoard({ board, workflows, stagedRuns, catalysts, onUpdateStagedRuns, onChange, onOpenBuilder, onOpenCatalysts }: RunBoardProps) {
  const [section, setSection] = useState<'staged' | 'running'>(stagedRuns.length ? 'staged' : 'running')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'attention' | 'completed'>('all')
  const [authoringOpen, setAuthoringOpen] = useState(false)
  const runningTiles = board.tiles.filter((tile) => tile.status !== 'not-started')
  const selectedTile = runningTiles.find((tile) => tile.id === selectedRunId)

  const patchTile = useCallback((id: string, patch: Partial<RunMonitorTile>) => {
    onChange({ ...board, tiles: board.tiles.map((tile) => tile.id === id ? { ...tile, ...patch } : tile) })
  }, [board, onChange])

  const startStaged = (run: PendingRun) => {
    const workflow = workflows.find((item) => item.id === run.workflowId || item.name === run.workflowName)
    const group = board.groups.find((item) => item.projectName === run.projectName) ?? board.groups[0]
    if (!group) return
    const tile: RunMonitorTile = {
      id: run.id,
      groupId: group.id,
      workflowId: workflow?.id ?? run.workflowId,
      workflowName: run.workflowName,
      objective: run.configuration.task,
      projectName: run.projectName,
      status: 'waiting-runner',
      steps: ['Specification preflight', ...(workflow?.steps ?? ['Prepare', 'Implement', 'Review', 'Verify', 'Handoff'])],
      createdAt: run.createdAt,
      updatedAt: new Date().toISOString(),
      graph: run.graph,
    }
    onChange({ ...board, tiles: [tile, ...board.tiles.filter((item) => item.id !== run.id && item.status !== 'not-started')] })
    onUpdateStagedRuns(stagedRuns.filter((item) => item.id !== run.id))
    setSection('running')
    setSelectedRunId(run.id)
  }

  const filteredTiles = runningTiles.filter((tile) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${tile.workflowName} ${tile.objective ?? ''} ${tile.projectName ?? ''}`.toLowerCase().includes(query)
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' && ['waiting-runner', 'running'].includes(tile.status))
      || (statusFilter === 'attention' && tile.status === 'blocked')
      || (statusFilter === 'completed' && tile.status === 'completed')
    return matchesSearch && matchesStatus
  })

  if (selectedTile) return <ExpandedRun tile={selectedTile} onBack={() => setSelectedRunId(null)} onPatch={(patch) => patchTile(selectedTile.id, patch)} />

  return (
    <div className="run-board-shell">
      <div className="runs-heading">
        <div><span className="eyebrow">Operations</span><h1>Runs</h1><p>Prepare work before it starts, then watch the workflow and agent stream while it runs.</p></div>
        <button className="subtle-button" onClick={() => setAuthoringOpen((current) => !current)}><Bot size={14} /> Build with agent</button>
      </div>

      {authoringOpen && <AgentAuthoringPanel onClose={() => setAuthoringOpen(false)} onOpenBuilder={onOpenBuilder} />}

      <div className="run-section-tabs" role="tablist" aria-label="Run state">
        <button role="tab" aria-selected={section === 'staged'} className={section === 'staged' ? 'active' : ''} onClick={() => setSection('staged')}><span><FileJson2 size={15} /> Staged</span><em>{stagedRuns.length}</em><small>Prepared and editable</small></button>
        <button role="tab" aria-selected={section === 'running'} className={section === 'running' ? 'active' : ''} onClick={() => setSection('running')}><span><Activity size={15} /> Running</span><em>{runningTiles.length}</em><small>Live, blocked, and complete</small></button>
      </div>

      {section === 'staged' ? <section className="runs-section">
        <div className="runs-section-heading"><div><h2>Staged workflows</h2><p>These assignments are ready for a manual launch or a verified catalyst event.</p></div><button className="primary-cta small" onClick={onOpenBuilder}>Stage another workflow <ArrowRight size={13} /></button></div>
        {stagedRuns.length ? <div className="staged-run-list">
          <div className="staged-list-header"><span>Workflow and objective</span><span>Project</span><span>Run policy</span><span>Prepared</span><span /></div>
          {stagedRuns.map((run) => {
            const catalyst = run.preparedBy === 'catalyst' ? catalysts.find((item) => item.workflowId === run.workflowId) : undefined
            return <article className={`staged-run-row ${run.preparedBy === 'catalyst' ? 'catalyst-staged' : ''}`} key={run.id}>
            <div className="staged-run-name"><span>{run.preparedBy === 'catalyst' ? <Zap size={15} /> : <Workflow size={15} />}</span><div><strong>{run.workflowName}</strong><p>{run.configuration.task}</p></div></div>
            <span>{run.projectName || 'No project'}</span>
            <div className="run-policy">{run.preparedBy === 'catalyst' ? <><span>Catalyst event</span><span>{catalyst ? catalyst.status === 'paused' ? 'paused' : 'configured' : 'setup required'}</span></> : <><span>{run.configuration.autonomy}</span><span>{run.configuration.execution === 'dry-run' ? 'dry run' : 'execute'}</span></>}<span className="run-spec-policy"><Sparkles size={10} /> {run.configuration.specificationMode ?? 'adaptive'} spec</span></div>
            <time>{new Date(run.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
            <div className="staged-actions"><button onClick={onOpenBuilder}>Edit</button>{run.preparedBy === 'catalyst' ? catalyst && catalyst.status !== 'paused' ? <span className="catalyst-waiting"><Radio size={12} /> Waiting for event</span> : <button className="start-staged" onClick={onOpenCatalysts}><Zap size={12} /> {catalyst ? 'Enable catalyst' : 'Configure catalyst'}</button> : <button className="start-staged" onClick={() => startStaged(run)}><Play size={12} /> Run workflow</button>}<button className="remove-staged" onClick={() => onUpdateStagedRuns(stagedRuns.filter((item) => item.id !== run.id))} aria-label={`Delete ${run.workflowName} staged run`}><Trash2 size={13} /></button></div>
          </article>})}
        </div> : <div className="runs-empty"><FileJson2 size={24} /><h2>No staged workflows</h2><p>Use the builder to define an objective and run policy. Relay will hold the assignment here until you start it.</p><button className="primary-cta small" onClick={onOpenBuilder}>Open builder</button></div>}
      </section> : <section className="runs-section">
        <div className="running-toolbar">
          <div className="run-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search runs" aria-label="Search runs" /></div>
          <div className="run-status-filters">{(['all', 'active', 'attention', 'completed'] as const).map((value) => <button className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)} key={value}>{value}</button>)}</div>
        </div>
        {filteredTiles.length ? <div className={`monitor-grid columns-${board.columns}`}>
          {filteredTiles.map((tile) => {
            const copy = statusCopy[tile.status]
            return <article className={`run-monitor-tile status-${tile.status}`} key={tile.id}>
              <button className="run-tile-open" onClick={() => setSelectedRunId(tile.id)} aria-label={`Open ${tile.workflowName} run`}>
                <div className="run-tile-heading"><span className="run-state-icon"><Radio size={15} /></span><div><h3>{tile.workflowName}</h3><p>{tile.objective || 'No run objective.'}</p></div><span className={`run-status-pill ${tile.status}`}><i /> {copy.label}</span><ChevronRight size={15} /></div>
                <WorkflowRunGraph tile={tile} />
                <div className="run-tile-footer"><div><strong>{tile.projectName || 'No project'}</strong><span>{copy.detail}</span></div><span className="open-run-label">Open live view <ArrowRight size={12} /></span></div>
              </button>
            </article>
          })}
        </div> : <div className="runs-empty"><Activity size={24} /><h2>{runningTiles.length ? 'No runs match this view' : 'No running workflows'}</h2><p>{runningTiles.length ? 'Change the status filter or search query.' : 'Run a staged workflow first. It will appear here while waiting for the runner.'}</p>{!runningTiles.length && <button className="primary-cta small" onClick={() => setSection('staged')}>View staged workflows</button>}</div>}
      </section>}
    </div>
  )
}
