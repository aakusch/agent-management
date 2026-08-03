import { useState } from 'react'
import {
  Bot,
  BrainCircuit,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderGit2,
  Layers3,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Wrench,
  X,
} from 'lucide-react'
import type { ProjectContext, ReasoningEffort, RelayTool, WorkflowNode } from '../types/workflow'

interface InspectorProps {
  node: WorkflowNode | null
  project: ProjectContext
  sourceInstruction: string
  onClose: () => void
  onUpdateNode: (id: string, patch: Partial<WorkflowNode['data']>) => void
  onOpenProjectConfig: () => void
}

const effortOptions: { id: ReasoningEffort; label: string; detail: string }[] = [
  { id: 'low', label: 'Low', detail: 'Fast' },
  { id: 'medium', label: 'Medium', detail: 'Balanced' },
  { id: 'high', label: 'High', detail: 'Thorough' },
  { id: 'xhigh', label: 'X-high', detail: 'Deepest' },
]

const toolOptions: { id: RelayTool; label: string }[] = [
  { id: 'filesystem', label: 'Files' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'git', label: 'Git' },
  { id: 'browser', label: 'Browser' },
  { id: 'web', label: 'Web' },
]

export function Inspector({ node, project, sourceInstruction, onClose, onUpdateNode, onOpenProjectConfig }: InspectorProps) {
  const [tab, setTab] = useState<'setup' | 'prompt' | 'source'>('setup')
  if (!node) return null

  const sourcePath = node.data.subworkflow ? `workflows/${node.data.subworkflow.workflowId}.json` : `components/${node.data.templateId}.md`
  const execution = node.data.execution ?? {}
  const effectiveModel = execution.model || project.defaults.model
  const effectiveEffort = execution.effort || project.defaults.effort
  const effectiveTools = (execution.tools ?? project.defaults.tools).filter((tool) => project.defaults.tools.includes(tool))
  const instructionChanged = node.data.instruction !== sourceInstruction
  const supportsAgentRuntime = node.data.kind === 'agent' || node.data.kind === 'judge'
  const supportsTools = supportsAgentRuntime || node.data.kind === 'tool'

  const updateExecution = <Key extends keyof NonNullable<WorkflowNode['data']['execution']>>(
    key: Key,
    value: NonNullable<WorkflowNode['data']['execution']>[Key] | undefined,
  ) => {
    const next = { ...execution }
    if (value === undefined || value === '') delete next[key]
    else next[key] = value
    onUpdateNode(node.id, { execution: next })
  }

  const updateSubworkflow = (patch: Partial<NonNullable<WorkflowNode['data']['subworkflow']>>) => {
    if (!node.data.subworkflow) return
    onUpdateNode(node.id, { subworkflow: { ...node.data.subworkflow, ...patch } })
  }

  const toggleTool = (tool: RelayTool) => {
    const custom = execution.tools ?? [...project.defaults.tools]
    updateExecution('tools', custom.includes(tool) ? custom.filter((item) => item !== tool) : [...custom, tool])
  }

  return (
    <aside className="inspector-panel component-inspector">
      <div className="inspector-heading component-inspector-heading">
        <div className="inspector-component-title">
          <span className={`inspector-kind tone-${node.data.color}`}><Bot size={15} /></span>
          <div><span className="eyebrow">{node.data.kind} component</span><h2>{node.data.label}</h2></div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close component inspector"><X size={17} /></button>
      </div>

      <div className="inspector-tabs" role="tablist" aria-label="Component editor">
        <button role="tab" aria-selected={tab === 'setup'} className={tab === 'setup' ? 'active' : ''} onClick={() => setTab('setup')}><Settings2 size={14} /> Setup</button>
        <button role="tab" aria-selected={tab === 'prompt'} className={tab === 'prompt' ? 'active' : ''} onClick={() => setTab('prompt')}><FileText size={14} /> Prompt{instructionChanged && <i />}</button>
        <button role="tab" aria-selected={tab === 'source'} className={tab === 'source' ? 'active' : ''} onClick={() => setTab('source')}><ExternalLink size={14} /> Source</button>
      </div>

      <div className="inspector-scroll">
        {tab === 'setup' && <>
          <section className="form-section inspector-section-card">
            <div className="inspector-section-heading"><span><SlidersHorizontal size={14} /></span><div><h3>Workflow instance</h3><p>Changes apply only to this node.</p></div></div>
            <label><span>Name</span><input value={node.data.label} onChange={(event) => onUpdateNode(node.id, { label: event.target.value })} /></label>
            <label><span>Purpose in this workflow</span><textarea rows={3} value={node.data.description} onChange={(event) => onUpdateNode(node.id, { description: event.target.value })} /></label>
          </section>

          {(supportsAgentRuntime || supportsTools) && <section className="form-section inspector-section-card runtime-settings">
            <div className="inspector-section-heading"><span><BrainCircuit size={14} /></span><div><h3>Agent runtime</h3><p>Override project defaults only when this step needs it.</p></div></div>
            {supportsAgentRuntime && <>
              <label>
                <span>Model <em>{execution.model ? 'Override' : 'Project default'}</em></span>
                <div className="inheritable-input"><input list="relay-model-suggestions" value={execution.model ?? ''} onChange={(event) => updateExecution('model', event.target.value || undefined)} placeholder={`Inherit · ${project.defaults.model}`} />{execution.model && <button onClick={() => updateExecution('model', undefined)} aria-label="Reset model to project default"><RotateCcw size={13} /></button>}</div>
                <datalist id="relay-model-suggestions"><option value="auto" /><option value="openai/model-id" /><option value="anthropic/model-id" /><option value="google/model-id" /></datalist>
              </label>
              <div className="runtime-field-label"><span>Reasoning effort</span><em>{execution.effort ? 'Override' : `Inherits ${project.defaults.effort}`}</em></div>
              <div className="effort-picker" role="group" aria-label="Reasoning effort">
                {effortOptions.map((option) => <button key={option.id} className={effectiveEffort === option.id ? 'selected' : ''} aria-pressed={effectiveEffort === option.id} onClick={() => updateExecution('effort', option.id)}><strong>{option.label}</strong><small>{option.detail}</small></button>)}
              </div>
              {execution.effort && <button className="inherit-reset" onClick={() => updateExecution('effort', undefined)}><RotateCcw size={12} /> Use project effort</button>}
            </>}

            {supportsTools && <>
              <div className="runtime-field-label tool-heading"><span>Tools</span><div className="inherit-choice"><button className={!execution.tools ? 'active' : ''} onClick={() => updateExecution('tools', undefined)}>Inherit</button><button className={execution.tools ? 'active' : ''} onClick={() => updateExecution('tools', execution.tools ?? [...project.defaults.tools])}>Custom</button></div></div>
              <div className={`tool-picker ${!execution.tools ? 'inherited' : ''}`}>
                {toolOptions.map((tool) => <button key={tool.id} disabled={!execution.tools || !project.defaults.tools.includes(tool.id)} className={effectiveTools.includes(tool.id) ? 'selected' : ''} aria-pressed={effectiveTools.includes(tool.id)} title={!project.defaults.tools.includes(tool.id) ? 'Enable this tool in project configuration first' : undefined} onClick={() => toggleTool(tool.id)}><Wrench size={12} /> {tool.label}</button>)}
              </div>
            </>}

            <div className="resolved-runtime"><span>Resolved for this node</span><strong>{effectiveModel} · {effectiveEffort}{supportsTools ? ` · ${effectiveTools.length} tools` : ''}</strong></div>
          </section>}

          {node.data.subworkflow && <section className="form-section inspector-section-card nested-workflow-settings">
            <div className="inspector-section-heading"><span><Layers3 size={14} /></span><div><h3>Nested workflow</h3><p>Control the child execution boundary.</p></div></div>
            <div className="nested-workflow-id"><span>Workflow reference</span><code>{node.data.subworkflow.workflowId}</code></div>
            <label><span>Execution boundary</span><select value={node.data.subworkflow.execution} onChange={(event) => updateSubworkflow({ execution: event.target.value as NonNullable<WorkflowNode['data']['subworkflow']>['execution'] })}><option value="isolated">Isolated child run</option><option value="inline">Inline in parent run</option></select></label>
            <label><span>Context passed</span><select value={node.data.subworkflow.context} onChange={(event) => updateSubworkflow({ context: event.target.value as NonNullable<WorkflowNode['data']['subworkflow']>['context'] })}><option value="inherit">Inherit parent context</option><option value="mapped">Mapped inputs only</option><option value="none">Objective only</option></select></label>
            <label><span>If child workflow fails</span><select value={node.data.subworkflow.onFailure} onChange={(event) => updateSubworkflow({ onFailure: event.target.value as NonNullable<WorkflowNode['data']['subworkflow']>['onFailure'] })}><option value="bubble">Fail parent step</option><option value="pause">Pause for decision</option><option value="continue">Continue with failure artifact</option></select></label>
          </section>}

          <section className="project-context-summary">
            <span className="project-context-icon"><FolderGit2 size={15} /></span>
            <div><span>Project context</span><strong>{project.root ? project.name : 'No project connected'}</strong><small>{project.root || 'Choose a repository, defaults, tools, and variables.'}</small></div>
            <button onClick={onOpenProjectConfig} aria-label="Open project configuration"><ChevronRight size={15} /></button>
          </section>
        </>}

        {tab === 'prompt' && <section className="form-section prompt-editor-section">
          <div className="prompt-editor-heading"><div><span className="eyebrow">Effective instruction</span><h3>{instructionChanged ? 'Customized for this node' : 'Using reusable source'}</h3></div>{instructionChanged && <button className="inherit-reset" onClick={() => onUpdateNode(node.id, { instruction: sourceInstruction })}><RotateCcw size={12} /> Reset</button>}</div>
          <textarea className="instruction-editor" rows={24} value={node.data.instruction} onChange={(event) => onUpdateNode(node.id, { instruction: event.target.value })} aria-label="Component instruction override" />
          <div className="prompt-editor-footer"><span>{node.data.instruction.length.toLocaleString()} characters</span><span>{instructionChanged ? 'Node override' : sourcePath}</span></div>
          <p className="form-hint">This prompt is sent with the run objective and resolved project context. Editing it does not change the reusable Markdown component.</p>
        </section>}

        {tab === 'source' && <section className="form-section source-panel">
          <div className="source-file-heading"><FileText size={15} /> {sourcePath}</div>
          <pre>{node.data.subworkflow ? JSON.stringify({ type: 'workflow-reference', ...node.data.subworkflow }, null, 2) : `---\nid: ${node.data.templateId}\nname: ${node.data.label}\nkind: ${node.data.kind}\n---\n\n${sourceInstruction}`}</pre>
          <button className="source-to-prompt" onClick={() => setTab('prompt')}><span><FileText size={14} /> Customize this node’s prompt</span><ChevronRight size={14} /></button>
          <p className="form-hint">The source is shared by every workflow using this component. Create a node override from the Prompt tab.</p>
        </section>}
      </div>
    </aside>
  )
}
