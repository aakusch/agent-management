import { useState } from 'react'
import {
  Bot,
  BrainCircuit,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderGit2,
  GitFork,
  Layers3,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Wrench,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import type { ProjectContext, ReasoningEffort, RelayTool, WorkflowModuleDefinition, WorkflowNode } from '../types/workflow'
import type { CatalystDefinition } from '../types/catalog'
import { describeCatalyst } from '../lib/catalysts'

interface InspectorProps {
  node: WorkflowNode | null
  project: ProjectContext
  sourceInstruction: string
  catalysts: CatalystDefinition[]
  workflowId: string
  onClose: () => void
  onUpdateNode: (id: string, patch: Partial<WorkflowNode['data']>) => void
  onOpenProjectConfig: () => void
  onOpenCatalysts: () => void
  onToggleCatalyst: (id: string) => void
  modules: WorkflowModuleDefinition[]
  onExpandModule: (nodeId: string) => void
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

export function Inspector({ node, project, sourceInstruction, catalysts, workflowId, onClose, onUpdateNode, onOpenProjectConfig, onOpenCatalysts, onToggleCatalyst, modules, onExpandModule }: InspectorProps) {
  const [tab, setTab] = useState<'setup' | 'prompt' | 'source'>('setup')
  if (!node) return null

  const sourcePath = node.data.subworkflow ? `workflows/${node.data.subworkflow.workflowId}.json` : `components/${node.data.templateId}.md`
  const execution = node.data.execution ?? {}
  const effectiveEffort = execution.effort || project.defaults.effort
  const effectiveTools = (execution.tools ?? project.defaults.tools).filter((tool) => project.defaults.tools.includes(tool))
  const instructionChanged = node.data.instruction !== sourceInstruction
  const supportsAgentRuntime = node.data.kind === 'agent' || node.data.kind === 'judge'
  const supportsTools = supportsAgentRuntime || node.data.kind === 'tool'
  const isCatalyst = node.data.kind === 'catalyst'
  const isModule = node.data.kind === 'module'
  const isLogic = node.data.kind === 'router'

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
  const updateOverride = (key: string, value: string) => onUpdateNode(node.id, { overrides: { ...node.data.overrides, [key]: value } })

  if (isCatalyst) {
    const availableCatalysts = catalysts.filter((catalyst) => catalyst.workflowId === workflowId)
    const selectedCatalyst = availableCatalysts.find((catalyst) => catalyst.id === node.data.catalyst?.definitionId) ?? availableCatalysts[0]
    return <aside className="inspector-panel component-inspector platform-entry-inspector">
      <div className="inspector-heading component-inspector-heading">
        <div className="inspector-component-title">
          <span className={`inspector-kind tone-${node.data.color}`}><Zap size={15} /></span>
          <div><span className="eyebrow">Platform entrypoint</span><h2>{node.data.label}</h2></div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close Catalyst inspector"><X size={17} /></button>
      </div>
      <div className="inspector-scroll">
        <section className="form-section inspector-section-card">
          <div className="inspector-section-heading"><span><SlidersHorizontal size={14} /></span><div><h3>Canvas instance</h3><p>How this entrypoint appears in the workflow.</p></div></div>
          <label><span>Name</span><input value={node.data.label} onChange={(event) => onUpdateNode(node.id, { label: event.target.value })} /></label>
          <label><span>Purpose in this workflow</span><textarea rows={3} value={node.data.description} onChange={(event) => onUpdateNode(node.id, { description: event.target.value })} /></label>
        </section>
        <section className="inspector-section-card catalyst-binding-card">
          <div className="inspector-section-heading"><span><Zap size={14} /></span><div><h3>Connected catalyst</h3><p>Select a platform trigger created for this workflow.</p></div></div>
          {availableCatalysts.length ? <>
            <label><span>Catalyst</span><select value={selectedCatalyst?.id ?? ''} onChange={(event) => onUpdateNode(node.id, { catalyst: { definitionId: event.target.value } })}>{availableCatalysts.map((catalyst) => <option key={catalyst.id} value={catalyst.id}>{catalyst.name}</option>)}</select></label>
            {selectedCatalyst && <div className="bound-catalyst-summary"><span><strong>{selectedCatalyst.kind.replaceAll('-', ' ')}</strong><small>{describeCatalyst(selectedCatalyst)}</small></span><label className="switch-control"><input type="checkbox" checked={selectedCatalyst.status !== 'paused'} onChange={() => onToggleCatalyst(selectedCatalyst.id)} /><i /><span>{selectedCatalyst.status === 'paused' ? 'Paused' : 'Enabled'}</span></label></div>}
            <button className="secondary-cta catalyst-manage-button" onClick={onOpenCatalysts}>Manage catalysts <ChevronRight size={13} /></button>
          </> : <div className="catalyst-binding-empty"><p>No Catalyst has been configured for this workflow yet.</p><button className="secondary-cta" onClick={onOpenCatalysts}>Configure catalyst <ChevronRight size={13} /></button></div>}
        </section>
        <p className="platform-entry-hint">Connect this node to the first executable component, then use <strong>Stage</strong> to save the workflow and configure its hook, connector event, schedule, or query.</p>
      </div>
    </aside>
  }

  if (isModule) {
    const definition = modules.find((module) => module.id === node.data.module?.moduleId)
    return <aside className="inspector-panel component-inspector module-inspector">
      <div className="inspector-heading component-inspector-heading"><div className="inspector-component-title"><span className={`inspector-kind tone-${node.data.color}`}><Layers3 size={15} /></span><div><span className="eyebrow">Reusable module</span><h2>{node.data.label}</h2></div></div><button className="icon-button" onClick={onClose} aria-label="Close module inspector"><X size={17} /></button></div>
      <div className="inspector-scroll">
        <section className="module-instance-card"><div><span className="status-chip ready">Linked · v{definition?.version ?? node.data.module?.version}</span><p>{definition?.description ?? node.data.description}</p></div><label><span>Name in this workflow</span><input value={node.data.label} onChange={(event) => onUpdateNode(node.id, { label: event.target.value })} /></label></section>
        {definition && <>
          <section className="inspector-section-card module-contract-card"><div className="inspector-section-heading"><span><Layers3 size={14} /></span><div><h3>Public contract</h3><p>Only these values cross the module boundary.</p></div></div><div className="module-port-list"><div><span>Inputs</span>{definition.inputs.map((item) => <code key={item}>{item}</code>)}</div><div><span>Outputs</span>{definition.outputs.map((item) => <code key={item}>{item}</code>)}</div></div></section>
          <section className="inspector-section-card module-contents-card"><div className="inspector-section-heading"><span><Workflow size={14} /></span><div><h3>Inside this module</h3><p>{definition.nodes.length} components · {definition.edges.length} transitions</p></div></div><ol>{definition.nodes.map((item, index) => <li key={item.id}><span>{index + 1}</span><div><strong>{item.id.replaceAll('-', ' ')}</strong><small>{item.componentId}</small></div></li>)}</ol></section>
          <button className="expand-module-button" onClick={() => onExpandModule(node.id)}><Layers3 size={14} /><span><strong>Expand into editable components</strong><small>Detach a copy inside this workflow. The saved module remains unchanged.</small></span><ChevronRight size={14} /></button>
        </>}
        <section className="project-context-summary"><span className="project-context-icon"><FolderGit2 size={15} /></span><div><span>Project context</span><strong>{project.root ? project.name : 'No project connected'}</strong><small>Resolved by specification preflight at run start.</small></div><button onClick={onOpenProjectConfig}><ChevronRight size={15} /></button></section>
      </div>
    </aside>
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
              <div className="effort-picker compact" role="group" aria-label="Reasoning effort">
                {effortOptions.map((option) => <button key={option.id} title={option.detail} className={effectiveEffort === option.id ? 'selected' : ''} aria-pressed={effectiveEffort === option.id} onClick={() => updateExecution('effort', option.id)}><strong>{option.label}</strong></button>)}
              </div>
              {execution.effort && <button className="inherit-reset" onClick={() => updateExecution('effort', undefined)}><RotateCcw size={12} /> Use project effort</button>}
            </>}

            {supportsTools && <>
              <div className="runtime-field-label tool-heading"><span>Tools</span><div className="inherit-choice"><button className={!execution.tools ? 'active' : ''} onClick={() => updateExecution('tools', undefined)}>Inherit</button><button className={execution.tools ? 'active' : ''} onClick={() => updateExecution('tools', execution.tools ?? [...project.defaults.tools])}>Custom</button></div></div>
              {execution.tools && <div className="tool-picker">
                {toolOptions.filter((tool) => project.defaults.tools.includes(tool.id)).map((tool) => <button key={tool.id} className={effectiveTools.includes(tool.id) ? 'selected' : ''} aria-pressed={effectiveTools.includes(tool.id)} onClick={() => toggleTool(tool.id)}><Wrench size={12} /> {tool.label}</button>)}
              </div>}
            </>}
          </section>}

          {isLogic && <section className="form-section inspector-section-card logic-settings-card">
            <div className="inspector-section-heading"><span><GitFork size={14} /></span><div><h3>Deterministic logic</h3><p>Configure values and routes; no model is invoked.</p></div></div>
            <label><span>{node.data.templateId === 'switch-route' ? 'Cases' : node.data.templateId === 'merge-join' ? 'Join rule' : node.data.templateId.includes('test-result') ? 'Required checks' : node.data.templateId.includes('artifact') ? 'Required artifacts' : 'Expression or rule'}</span><textarea className="mono-input" rows={3} value={node.data.overrides['logic.rule'] ?? ''} onChange={(event) => updateOverride('logic.rule', event.target.value)} placeholder={node.data.templateId === 'switch-route' ? 'severity=critical → escalate\nseverity=warning → review\ndefault → continue' : node.data.templateId === 'merge-join' ? 'all required branches' : node.data.templateId.includes('test-result') ? 'typecheck, lint, test, build' : node.data.templateId.includes('artifact') ? 'patch, test_report' : 'verdict == pass'} /></label>
            <div className="form-row"><label><span>Success route</span><input value={node.data.overrides['logic.success'] ?? 'pass'} onChange={(event) => updateOverride('logic.success', event.target.value)} /></label><label><span>Fallback route</span><input value={node.data.overrides['logic.fallback'] ?? 'fail'} onChange={(event) => updateOverride('logic.fallback', event.target.value)} /></label></div>
            <label><span>Missing or invalid input</span><select value={node.data.overrides['logic.onUnknown'] ?? 'block'} onChange={(event) => updateOverride('logic.onUnknown', event.target.value)}><option value="block">Block and report</option><option value="fallback">Use fallback route</option><option value="human">Ask a human</option></select></label>
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
