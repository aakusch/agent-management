import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
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
  const dialogRef = useRef<HTMLFormElement>(null)
  const [task, setTask] = useState('')
  const [context, setContext] = useState('')
  const [autonomy, setAutonomy] = useState<RunConfiguration['autonomy']>('adaptive')
  const [allowAdjacentFixes, setAllowAdjacentFixes] = useState(true)
  const [retryFailures, setRetryFailures] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [execution, setExecution] = useState<RunConfiguration['execution']>('execute')
  const [maxDuration, setMaxDuration] = useState('')
  const [maxCost, setMaxCost] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const normalizedTask = task.trim()
    const duration = maxDuration ? Number(maxDuration) : undefined
    const cost = maxCost ? Number(maxCost) : undefined
    if (!normalizedTask) {
      setError('Describe the outcome you want the workflow to accomplish.')
      return
    }
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 1 || duration > 10_080)) {
      setError('Time limit must be between 1 minute and 7 days.')
      setAdvancedOpen(true)
      return
    }
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0 || cost > 100_000)) {
      setError('Cost budget must be between $0 and $100,000.')
      setAdvancedOpen(true)
      return
    }
    onStart({
      task: normalizedTask,
      context: context.trim() || undefined,
      autonomy,
      allowAdjacentFixes,
      retryFailures,
      execution,
      maxDurationMinutes: duration,
      maxCostUsd: cost,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form ref={dialogRef} className="start-run-modal" role="dialog" aria-modal="true" aria-labelledby="start-run-title" aria-describedby="start-run-description" onSubmit={submit} noValidate>
        <header className="modal-heading">
          <div>
            <span className="eyebrow">Prepare workflow run</span>
            <h2 id="start-run-title">What should the agents accomplish?</h2>
            <p id="start-run-description"><strong>{workflowName}</strong> will be prepared for {projectName}.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close prepare run dialog"><X size={17} /></button>
        </header>

        <div className="modal-scroll">
          <label className="task-prompt-field">
            <span>Task or objective <em>Required</em></span>
            <textarea
              autoFocus
              rows={6}
              maxLength={8000}
              value={task}
              onChange={(event) => { setTask(event.target.value); setError('') }}
              placeholder="Describe what you want accomplished, the desired outcome, and anything the agents should pay close attention to…"
              aria-invalid={Boolean(error && !task.trim())}
            />
            <small><Bot size={13} /> This is the kickoff prompt sent to the driver and carried through the workflow. <span>{task.length.toLocaleString()}/8,000</span></small>
          </label>

          {projectName === 'No project selected' && <div className="project-warning"><AlertTriangle size={15} /><p><strong>No project is connected.</strong> The CLI runner will need a project directory before it can execute this run.</p></div>}

          <div className="run-section-heading">
            <div><h3>How independently should it work?</h3><p>Choose how often Relay should stop and ask you.</p></div>
          </div>
          <div className="autonomy-grid">
            {autonomyOptions.map((option) => {
              const Icon = option.icon
              return <button type="button" aria-pressed={autonomy === option.id} key={option.id} className={`${autonomy === option.id ? 'selected' : ''} ${option.id === 'autonomous' ? 'autonomous' : ''}`} onClick={() => setAutonomy(option.id)}><span><Icon size={16} /></span><strong>{option.name}</strong><small>{option.description}</small></button>
            })}
          </div>
          {autonomy === 'autonomous' && <div className="autonomous-warning"><Zap size={15} /><p><strong>Permission prompts will be bypassed for this run.</strong> Project, workspace, operating-system, and provider hard limits still apply.</p></div>}

          <div className="run-checkboxes">
            <label><input type="checkbox" checked={allowAdjacentFixes} onChange={(event) => setAllowAdjacentFixes(event.target.checked)} /><span><strong>Allow safe adjacent fixes</strong><small>Resolve closely related issues when confidence is high.</small></span></label>
            <label><input type="checkbox" checked={retryFailures} onChange={(event) => setRetryFailures(event.target.checked)} /><span><strong>Retry failed components automatically</strong><small>Use the retry and loop limits already defined by the workflow.</small></span></label>
          </div>

          <button type="button" className={`advanced-toggle ${advancedOpen ? 'open' : ''}`} aria-expanded={advancedOpen} aria-controls="advanced-run-settings" onClick={() => setAdvancedOpen((current) => !current)}><span>Advanced and optional</span><small>Execution type, limits, and extra context</small><ChevronDown size={15} /></button>
          {advancedOpen && <div className="advanced-run-settings" id="advanced-run-settings">
            <label className="optional-context"><span>Additional context <em>Optional</em></span><textarea rows={3} maxLength={8000} value={context} onChange={(event) => setContext(event.target.value)} placeholder="Links, constraints, background, or temporary instructions…" /></label>
            <div className="execution-choice"><span>Execution</span><div role="group" aria-label="Execution mode"><button type="button" aria-pressed={execution === 'execute'} className={execution === 'execute' ? 'active' : ''} onClick={() => setExecution('execute')}><Play size={13} /> Execute</button><button type="button" aria-pressed={execution === 'dry-run'} className={execution === 'dry-run' ? 'active' : ''} onClick={() => setExecution('dry-run')}><FlaskConical size={13} /> Dry run</button></div></div>
            <div className="optional-limits">
              <label><span><Clock3 size={13} /> Time limit <em>Optional</em></span><div><input type="number" min="1" max="10080" value={maxDuration} onChange={(event) => { setMaxDuration(event.target.value); setError('') }} placeholder="Workflow default" /><small>minutes</small></div></label>
              <label><span><DollarSign size={13} /> Cost budget <em>Optional</em></span><div><input type="number" min="0" max="100000" step="0.5" value={maxCost} onChange={(event) => { setMaxCost(event.target.value); setError('') }} placeholder="No run override" /><small>USD</small></div></label>
            </div>
            <p className="optional-note">Leave these empty to use the workflow and workspace defaults.</p>
          </div>}
          {error && <div className="run-form-error" role="alert"><AlertTriangle size={14} /> {error}</div>}
        </div>

        <footer className="modal-footer">
          <div><span className={`autonomy-indicator ${autonomy}`}><i /> {autonomyOptions.find((option) => option.id === autonomy)?.name}</span><small>{execution === 'dry-run' ? 'Preview only · CLI connection required' : 'Execute · CLI connection required'}</small></div>
          <button type="button" className="secondary-cta" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-cta start-run-button" disabled={!task.trim()}><Play size={14} fill="currentColor" /> Prepare run</button>
        </footer>
      </form>
    </div>
  )
}
