import { GitBranch, PackageOpen, RotateCcw, Route, TimerReset, X } from 'lucide-react'
import { DEFAULT_HANDOFF } from '../lib/graph'
import type { WorkflowEdge, WorkflowEdgeData, WorkflowHandoff, WorkflowNode } from '../types/workflow'

interface TransitionInspectorProps {
  edge: WorkflowEdge | null
  sourceNode?: WorkflowNode
  targetNode?: WorkflowNode
  onClose: () => void
  onUpdateEdge: (id: string, patch: Partial<WorkflowEdgeData>) => void
}

const defaultLoop: NonNullable<WorkflowEdgeData['loop']> = {
  mode: 'bounded',
  maxIterations: 3,
  maxDurationMinutes: 30,
  stopOnNoProgress: 2,
  onExhausted: 'human',
}

const handoffOptions: { id: WorkflowHandoff; label: string; detail: string }[] = [
  { id: 'summary', label: 'Briefing', detail: 'The previous agent writes a short handoff: what it did, what it decided, what is left.' },
  { id: 'full', label: 'Everything', detail: 'The next step receives the full result and context of the previous step.' },
  { id: 'signal', label: 'Signal only', detail: 'Just proceed. The next step starts from the run objective and project context.' },
]

export function TransitionInspector({
  edge,
  sourceNode,
  targetNode,
  onClose,
  onUpdateEdge,
}: TransitionInspectorProps) {
  if (!edge) return null

  const data = edge.data ?? {}
  const trigger = data.trigger ?? (data.condition ? 'condition' : 'always')
  const handoff = data.handoff ?? DEFAULT_HANDOFF
  const loop = data.loop
  const updateLoop = (patch: Partial<NonNullable<WorkflowEdgeData['loop']>>) => {
    onUpdateEdge(edge.id, { loop: { ...(loop ?? defaultLoop), ...patch } })
  }

  return (
    <aside className="inspector-panel transition-inspector">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">Selected transition</span>
          <h2>{sourceNode?.data.label ?? edge.source} <span>→</span> {targetNode?.data.label ?? edge.target}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close transition inspector"><X size={17} /></button>
      </div>

      <div className="transition-note">
        <Route size={14} /> These settings belong to this connection, not either component.
      </div>

      <div className="inspector-scroll">
        <section className="form-section">
          <h3><GitBranch size={14} /> Routing</h3>
          <label>
            <span>Connection label <em>Optional</em></span>
            <input
              value={data.label ?? ''}
              placeholder="e.g. approved"
              onChange={(event) => onUpdateEdge(edge.id, { label: event.target.value })}
            />
          </label>
          <label>
            <span>Continue when</span>
            <select
              value={trigger}
              onChange={(event) => onUpdateEdge(edge.id, { trigger: event.target.value as WorkflowEdgeData['trigger'] })}
            >
              <option value="always">Previous step completes</option>
              <option value="condition">Condition matches</option>
              <option value="human">Human approves</option>
            </select>
          </label>
          {trigger === 'condition' && (
            <label>
              <span>Condition</span>
              <input
                className="mono-input"
                value={data.condition ?? ''}
                placeholder="route == approved"
                onChange={(event) => onUpdateEdge(edge.id, { condition: event.target.value })}
              />
            </label>
          )}
          {trigger === 'human' && <p className="form-hint">The driver pauses this route until a user approves it in the CLI or run view.</p>}
        </section>

        <section className="form-section">
          <h3><PackageOpen size={14} /> Handoff</h3>
          <label>
            <span>What the next step receives</span>
            <select value={handoff} onChange={(event) => onUpdateEdge(edge.id, { handoff: event.target.value as WorkflowHandoff })}>
              {handoffOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <p className="form-hint">{handoffOptions.find((option) => option.id === handoff)?.detail}</p>
        </section>

        <section className="form-section">
          <div className="section-toggle">
            <div>
              <h3><RotateCcw size={14} /> Loop policy</h3>
              <p>Allow this connection to revisit an earlier step.</p>
            </div>
            <button
              className={`mini-toggle ${loop ? 'on' : ''}`}
              onClick={() => onUpdateEdge(edge.id, { loop: loop ? undefined : defaultLoop })}
              aria-pressed={Boolean(loop)}
            >
              <i /> {loop ? 'On' : 'Off'}
            </button>
          </div>
          {loop && (
            <div className="loop-fields">
              <label>
                <span>Loop mode</span>
                <select value={loop.mode} onChange={(event) => updateLoop({ mode: event.target.value as typeof loop.mode })}>
                  <option value="bounded">Bounded</option>
                  <option value="until-cancelled">Until cancelled</option>
                </select>
              </label>
              {loop.mode === 'bounded' && (
                <div className="form-row">
                  <label>
                    <span>Max passes</span>
                    <input type="number" min="1" value={loop.maxIterations ?? 3} onChange={(event) => updateLoop({ maxIterations: Number(event.target.value) })} />
                  </label>
                  <label>
                    <span>Max minutes</span>
                    <input type="number" min="1" value={loop.maxDurationMinutes ?? 30} onChange={(event) => updateLoop({ maxDurationMinutes: Number(event.target.value) })} />
                  </label>
                </div>
              )}
              <div className="form-row">
                <label>
                  <span>No-progress limit</span>
                  <input type="number" min="1" value={loop.stopOnNoProgress ?? 2} onChange={(event) => updateLoop({ stopOnNoProgress: Number(event.target.value) })} />
                </label>
                <label>
                  <span>When exhausted</span>
                  <select value={loop.onExhausted} onChange={(event) => updateLoop({ onExhausted: event.target.value as typeof loop.onExhausted })}>
                    <option value="human">Ask a human</option>
                    <option value="pause">Pause run</option>
                    <option value="fail">Fail run</option>
                  </select>
                </label>
              </div>
            </div>
          )}
          {!loop && <p className="form-hint"><TimerReset size={12} /> Cycles must be explicitly enabled and bounded before execution.</p>}
        </section>
      </div>
    </aside>
  )
}
