import { useState } from 'react'
import {
  Bot,
  ChevronDown,
  Clock3,
  DollarSign,
  FlaskConical,
  Play,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'

export interface RunConfiguration {
  task: string
  context?: string
  autonomy: 'guided' | 'adaptive' | 'autonomous'
  allowAdjacentFixes: boolean
  retryFailures: boolean
  execution: 'execute' | 'dry-run'
  maxDurationMinutes?: number
  maxCostUsd?: number
}

interface StartRunModalProps {
  workflowName: string
  projectName: string
  onClose: () => void
  onStart: (configuration: RunConfiguration) => void
}

const autonomyOptions = [
  {
    id: 'guided' as const,
    icon: ShieldCheck,
    name: 'Guided',
    description: 'Ask before scope changes and permissioned actions.',
  },
  {
    id: 'adaptive' as const,
    icon: Sparkles,
    name: 'Adaptive',
    description: 'Handle safe decisions and ask when confidence is low.',
  },
  {
    id: 'autonomous' as const,
    icon: Zap,
    name: 'Full autonomous',
    description: 'Execute end-to-end and bypass run-time permission prompts.',
  },
]

export function StartRunModal({ workflowName, projectName, onClose, onStart }: StartRunModalProps) {
  const [task, setTask] = useState('')
  const [context, setContext] = useState('')
  const [autonomy, setAutonomy] = useState<RunConfiguration['autonomy']>('adaptive')
  const [allowAdjacentFixes, setAllowAdjacentFixes] = useState(true)
  const [retryFailures, setRetryFailures] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [execution, setExecution] = useState<RunConfiguration['execution']>('execute')
  const [maxDuration, setMaxDuration] = useState('')
  const [maxCost, setMaxCost] = useState('')

  const submit = () => {
    if (!task.trim()) return
    onStart({
      task: task.trim(),
      context: context.trim() || undefined,
      autonomy,
      allowAdjacentFixes,
      retryFailures,
      execution,
      maxDurationMinutes: maxDuration ? Number(maxDuration) : undefined,
      maxCostUsd: maxCost ? Number(maxCost) : undefined,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="start-run-modal" role="dialog" aria-modal="true" aria-labelledby="start-run-title">
        <header className="modal-heading">
          <div>
            <span className="eyebrow">Start workflow</span>
            <h2 id="start-run-title">What should the agents accomplish?</h2>
            <p><strong>{workflowName}</strong> will run against {projectName}.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close start run dialog"><X size={17} /></button>
        </header>

        <div className="modal-scroll">
          <label className="task-prompt-field">
            <span>Task or objective <em>Required</em></span>
            <textarea
              autoFocus
              rows={6}
              value={task}
              onChange={(event) => setTask(event.target.value)}
              placeholder="Describe what you want accomplished, the desired outcome, and anything the agents should pay close attention to…"
            />
            <small><Bot size={13} /> This is the kickoff prompt sent to the driver and carried through the workflow.</small>
          </label>

          <div className="run-section-heading">
            <div><h3>How independently should it work?</h3><p>Choose how often Relay should stop and ask you.</p></div>
          </div>
          <div className="autonomy-grid">
            {autonomyOptions.map((option) => {
              const Icon = option.icon
              return <button key={option.id} className={`${autonomy === option.id ? 'selected' : ''} ${option.id === 'autonomous' ? 'autonomous' : ''}`} onClick={() => setAutonomy(option.id)}><span><Icon size={16} /></span><strong>{option.name}</strong><small>{option.description}</small></button>
            })}
          </div>
          {autonomy === 'autonomous' && <div className="autonomous-warning"><Zap size={15} /><p><strong>Permission prompts will be bypassed for this run.</strong> Project, workspace, operating-system, and provider hard limits still apply.</p></div>}

          <div className="run-checkboxes">
            <label><input type="checkbox" checked={allowAdjacentFixes} onChange={(event) => setAllowAdjacentFixes(event.target.checked)} /><span><strong>Allow safe adjacent fixes</strong><small>Resolve closely related issues when confidence is high.</small></span></label>
            <label><input type="checkbox" checked={retryFailures} onChange={(event) => setRetryFailures(event.target.checked)} /><span><strong>Retry failed components automatically</strong><small>Use the retry and loop limits already defined by the workflow.</small></span></label>
          </div>

          <button className={`advanced-toggle ${advancedOpen ? 'open' : ''}`} onClick={() => setAdvancedOpen((current) => !current)}><span>Advanced and optional</span><small>Execution type, limits, and extra context</small><ChevronDown size={15} /></button>
          {advancedOpen && <div className="advanced-run-settings">
            <label className="optional-context"><span>Additional context <em>Optional</em></span><textarea rows={3} value={context} onChange={(event) => setContext(event.target.value)} placeholder="Links, constraints, background, or temporary instructions…" /></label>
            <div className="execution-choice"><span>Execution</span><div><button className={execution === 'execute' ? 'active' : ''} onClick={() => setExecution('execute')}><Play size={13} /> Execute</button><button className={execution === 'dry-run' ? 'active' : ''} onClick={() => setExecution('dry-run')}><FlaskConical size={13} /> Dry run</button></div></div>
            <div className="optional-limits">
              <label><span><Clock3 size={13} /> Time limit <em>Optional</em></span><div><input type="number" min="1" value={maxDuration} onChange={(event) => setMaxDuration(event.target.value)} placeholder="Workflow default" /><small>minutes</small></div></label>
              <label><span><DollarSign size={13} /> Cost budget <em>Optional</em></span><div><input type="number" min="0" step="0.5" value={maxCost} onChange={(event) => setMaxCost(event.target.value)} placeholder="No run override" /><small>USD</small></div></label>
            </div>
            <p className="optional-note">Leave these empty to use the workflow and workspace defaults.</p>
          </div>}
        </div>

        <footer className="modal-footer">
          <div><span className={`autonomy-indicator ${autonomy}`}><i /> {autonomyOptions.find((option) => option.id === autonomy)?.name}</span><small>{execution === 'dry-run' ? 'Preview only' : 'Real execution'}</small></div>
          <button className="secondary-cta" onClick={onClose}>Cancel</button>
          <button className="primary-cta start-run-button" disabled={!task.trim()} onClick={submit}><Play size={14} fill="currentColor" /> Start workflow</button>
        </footer>
      </section>
    </div>
  )
}
