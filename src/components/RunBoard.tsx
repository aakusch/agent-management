import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Columns2,
  GripVertical,
  LayoutGrid,
  Layers3,
  Link2,
  Plus,
  Radio,
  Rows3,
  TerminalSquare,
  Trash2,
  Workflow,
} from 'lucide-react'
import type { PendingRun, RunMonitorBoard, RunMonitorStatus, RunMonitorTile, WorkflowRecord } from '../types/catalog'

interface RunBoardProps {
  board: RunMonitorBoard
  workflows: WorkflowRecord[]
  pendingRun: PendingRun | null
  onChange: (board: RunMonitorBoard) => void
  onOpenBuilder: () => void
}

const statusCopy: Record<RunMonitorStatus, { label: string; detail: string }> = {
  'not-started': { label: 'Not started', detail: 'Open the builder when you are ready to prepare this run.' },
  'waiting-runner': { label: 'Waiting for runner', detail: 'Prepared on the web. Connect the CLI to begin execution.' },
  running: { label: 'Running', detail: 'Live events are streaming from the connected runner.' },
  blocked: { label: 'Needs attention', detail: 'The driver is waiting for a decision or conflict resolution.' },
  completed: { label: 'Completed', detail: 'All required workflow routes finished.' },
}

function MiniRunGraph({ tile }: { tile: RunMonitorTile }) {
  const fallback = ['Prepare', 'Implement', 'Review', 'Verify', 'Handoff']
  const supplied = tile.steps.every((step) => /^Step \d+$/.test(step)) ? [] : tile.steps
  const steps = supplied.length >= 5 ? supplied : [...supplied, ...fallback].slice(0, 5)
  const nodeClass = tile.status === 'running' ? 'active' : tile.status === 'blocked' ? 'attention' : tile.status === 'completed' ? 'complete' : ''

  return (
    <div className={`mini-run-graph status-${tile.status}`}>
      <svg viewBox="0 0 720 190" preserveAspectRatio="none" aria-hidden="true">
        <path d="M120 95 C165 95 170 44 215 44" />
        <path d="M120 95 C165 95 170 146 215 146" />
        <path d="M335 44 C380 44 385 95 430 95" />
        <path d="M335 146 C380 146 385 95 430 95" />
        <path d="M550 95 L605 95" />
        <path className="return-path" d="M490 132 C490 178 85 178 85 127" />
      </svg>
      <div className={`monitor-node start ${nodeClass}`}><i /><strong>{steps[0]}</strong><small>Start</small></div>
      <div className="monitor-parallel">
        <div className="monitor-node"><i /><strong>{steps[1]}</strong><small>Agent</small></div>
        <div className="monitor-node"><i /><strong>{steps[2]}</strong><small>Judge</small></div>
      </div>
      <div className="monitor-node gate"><i /><strong>{steps[3]}</strong><small>Gate</small></div>
      <div className="monitor-node end"><i /><strong>{steps[4]}</strong><small>Output</small></div>
    </div>
  )
}

export function RunBoard({ board, workflows, pendingRun, onChange, onOpenBuilder }: RunBoardProps) {
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? '')
  const [groupId, setGroupId] = useState(board.groups[0]?.id ?? '')
  const [addingGroup, setAddingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const counts = useMemo(() => ({
    running: board.tiles.filter((tile) => tile.status === 'running').length,
    waiting: board.tiles.filter((tile) => tile.status === 'waiting-runner').length,
    attention: board.tiles.filter((tile) => tile.status === 'blocked').length,
    arranged: board.tiles.length,
  }), [board.tiles])

  const addMonitor = () => {
    const workflow = workflows.find((item) => item.id === workflowId)
    const destination = board.groups.find((group) => group.id === groupId) ?? board.groups[0]
    if (!workflow || !destination) return
    const tile: RunMonitorTile = {
      id: `monitor-${Date.now()}`,
      groupId: destination.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      projectName: destination.projectName,
      status: 'not-started',
      steps: workflow.steps ?? ['Prepare', 'Implement', 'Review', 'Verify', 'Handoff'],
      createdAt: new Date().toISOString(),
    }
    onChange({ ...board, tiles: [...board.tiles, tile] })
  }

  const addGroup = () => {
    const name = groupName.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `group-${Date.now()}`
    onChange({ ...board, groups: [...board.groups, { id, name }] })
    setGroupId(id)
    setGroupName('')
    setAddingGroup(false)
  }

  const moveTile = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    const current = [...board.tiles]
    const from = current.findIndex((tile) => tile.id === draggedId)
    const to = current.findIndex((tile) => tile.id === targetId)
    if (from < 0 || to < 0) return
    const destinationGroupId = current[to].groupId
    const [moved] = current.splice(from, 1)
    moved.groupId = destinationGroupId
    current.splice(from < to ? to - 1 : to, 0, moved)
    onChange({ ...board, tiles: current })
    setDraggedId(null)
  }

  return (
    <div className="run-board-shell">
      <div className="run-board-heading">
        <div>
          <span className="eyebrow">Monitoring workspace</span>
          <input value={board.name} onChange={(event) => onChange({ ...board, name: event.target.value })} aria-label="Monitoring board name" />
          <p>Arrange the runs that belong together. Status remains disconnected until a Relay runner streams real events.</p>
        </div>
        <div className="board-summary">
          <span><i className="running" /> <strong>{counts.running}</strong> active</span>
          <span><i className="waiting" /> <strong>{counts.waiting}</strong> waiting</span>
          <span><i className="attention" /> <strong>{counts.attention}</strong> attention</span>
          <span><LayoutGrid size={13} /> <strong>{counts.arranged}</strong> arranged</span>
        </div>
      </div>

      <div className="run-board-toolbar">
        <div className="add-monitor-control">
          <select value={workflowId} onChange={(event) => setWorkflowId(event.target.value)} aria-label="Workflow to monitor">
            {workflows.map((workflow) => <option value={workflow.id} key={workflow.id}>{workflow.name}</option>)}
          </select>
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} aria-label="Monitoring group">
            {board.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
          </select>
          <button className="primary-cta small" onClick={addMonitor} disabled={!workflowId}><Plus size={14} /> Add run view</button>
        </div>
        <div className="board-view-controls">
          <button className={board.columns === 1 ? 'active' : ''} onClick={() => onChange({ ...board, columns: 1 })} aria-label="One column"><Rows3 size={15} /></button>
          <button className={board.columns === 2 ? 'active' : ''} onClick={() => onChange({ ...board, columns: 2 })} aria-label="Two columns"><Columns2 size={15} /></button>
          <button onClick={() => setAddingGroup(true)}><Plus size={14} /> Section</button>
        </div>
      </div>

      {addingGroup && <div className="add-group-row"><input autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addGroup() }} placeholder="Section name, e.g. Checkout services" /><button onClick={() => setAddingGroup(false)}>Cancel</button><button className="primary-cta small" onClick={addGroup}>Add section</button></div>}

      <div className="monitor-groups">
        {board.groups.map((group) => {
          const tiles = board.tiles.filter((tile) => tile.groupId === group.id)
          return (
            <section className="monitor-group" key={group.id}>
              <div className="monitor-group-heading">
                <span className="group-icon"><Layers3 size={15} /></span>
                <div><h2>{group.name}</h2><p>{group.projectName || 'Cross-project'} · {tiles.length} run{tiles.length === 1 ? '' : 's'}</p></div>
                <span className="group-health"><i /> {tiles.some((tile) => tile.status === 'blocked') ? 'Attention required' : tiles.some((tile) => tile.status === 'running') ? 'Activity live' : 'No active runner'}</span>
              </div>
              {tiles.length ? <div className={`monitor-grid columns-${board.columns}`}>
                {tiles.map((tile) => {
                  const copy = statusCopy[tile.status]
                  return (
                    <article
                      className={`run-monitor-tile status-${tile.status}`}
                      key={tile.id}
                      draggable
                      onDragStart={() => setDraggedId(tile.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => moveTile(tile.id)}
                    >
                      <div className="run-tile-heading">
                        <span className="drag-handle"><GripVertical size={15} /></span>
                        <span className="run-state-icon"><Radio size={15} /></span>
                        <div><h3>{tile.workflowName}</h3><p>{tile.objective || 'No run objective yet.'}</p></div>
                        <span className={`run-status-pill ${tile.status}`}><i /> {copy.label}</span>
                        <button className="tile-menu" onClick={() => onChange({ ...board, tiles: board.tiles.filter((item) => item.id !== tile.id) })} aria-label={`Remove ${tile.workflowName} from board`}><Trash2 size={14} /></button>
                      </div>

                      {(tile.catalyst || tile.parentWorkflow) && <div className="run-provenance">
                        {tile.catalyst && <span><Link2 size={12} /> {tile.catalyst}</span>}
                        {tile.parentWorkflow && <span><Workflow size={12} /> Parent: {tile.parentWorkflow}</span>}
                      </div>}

                      <MiniRunGraph tile={tile} />

                      <div className="run-tile-footer">
                        <div><strong>{copy.label}</strong><span>{copy.detail}</span></div>
                        {tile.status === 'waiting-runner' ? <code><TerminalSquare size={13} /> relay connect</code> : tile.status === 'not-started' ? <button onClick={onOpenBuilder}>Prepare run <ArrowRight size={13} /></button> : <button>Inspect <ArrowRight size={13} /></button>}
                      </div>
                    </article>
                  )
                })}
              </div> : <div className="monitor-group-empty"><Workflow size={20} /><div><strong>No runs arranged in this section</strong><span>Select a saved workflow above to add a monitor tile. This does not start execution.</span></div></div>}
            </section>
          )
        })}
      </div>

      {!pendingRun && board.tiles.length === 0 && <div className="monitor-board-onboarding"><AlertTriangle size={15} /><span>The board is ready, but no run has been prepared. Adding a view organizes it only; execution still starts from the workflow builder and connects through the CLI.</span></div>}
    </div>
  )
}
