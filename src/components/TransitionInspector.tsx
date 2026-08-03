import { GitBranch, PackageOpen, RotateCcw, Route, TimerReset, X } from 'lucide-react'
import type { WorkflowEdge, WorkflowEdgeData, WorkflowNode } from '../types/workflow'

interface TransitionInspectorProps {
  edge: WorkflowEdge | null
  sourceNode?: WorkflowNode
  targetNode?: WorkflowNode
  sourceOutputs: string[]
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

export function TransitionInspector({
  edge,
  sourceNode,
  targetNode,
  sourceOutputs,
  onClose,
  onUpdateEdge,
}: TransitionInspectorProps) {
  if (!edge) return null

  const data = edge.data ?? {}
  const trigger = data.trigger ?? (data.condition ? 'condition' : 'always')
  const payload = data.payload ?? { mode: 'all' as const }
  const loop = data.loop
  const updatePayload = (patch: Partial<NonNullable<WorkflowEdgeData['payload']>>) => {
    onUpdateEdge(edge.id, { payload: { ...payload, ...patch } })
  }
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
              <option value="delay">Delay has elapsed</option>
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
          {trigger === 'delay' && (
            <label>
              <span>Delay in seconds</span>
              <input
                type="number"
                min="0"
                value={data.delaySeconds ?? 0}
                onChange={(event) => onUpdateEdge(edge.id, { delaySeconds: Number(event.target.value) })}
              />
            </label>
          )}
          {trigger === 'human' && <p className="form-hint">The driver pauses this route until a user approves it in the CLI or run view.</p>}
          <div className="form-row">
            <label>
              <span>Priority</span>
              <input
                type="number"
                min="0"
                value={data.priority ?? 0}
                onChange={(event) => onUpdateEdge(edge.id, { priority: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>If blocked</span>
              <select
                value={data.onBlocked ?? 'wait'}
                onChange={(event) => onUpdateEdge(edge.id, { onBlocked: event.target.value as WorkflowEdgeData['onBlocked'] })}
              >
                <option value="wait">Wait</option>
                <option value="skip">Skip route</option>
                <option value="fail">Fail run</option>
              </select>
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3><PackageOpen size={14} /> Context passed</h3>
          <label>
            <span>Payload</span>
            <select value={payload.mode} onChange={(event) => updatePayload({ mode: event.target.value as NonNullable<WorkflowEdgeData['payload']>['mode'] })}>
              <option value="all">All outputs and context</option>
              <option value="summary">Compact summary only</option>
              <option value="selected">Selected outputs</option>
              <option value="none">Signal only — no context</option>
            </select>
          </label>
          {payload.mode === 'selected' && (
            <div className="payload-options">
              <span>Outputs to include</span>
              {sourceOutputs.length ? sourceOutputs.map((output) => {
                const checked = payload.include?.includes(output) ?? false
                return (
                  <label key={output}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => updatePayload({
                        include: checked
                          ? (payload.include ?? []).filter((item) => item !== output)
                          : [...(payload.include ?? []), output],
                      })}
                    />
                    <code>{output}</code>
                  </label>
                )
              }) : <p className="form-hint">This component has no declared outputs yet.</p>}
            </div>
          )}
          <p className="form-hint">Payload selection controls the next step's context without changing the reusable component contract.</p>
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
