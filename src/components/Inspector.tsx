import { useState } from 'react'
import { Braces, ChevronRight, FileText, Layers3, Settings2, SlidersHorizontal, X } from 'lucide-react'
import type { ProjectContext, WorkflowNode } from '../types/workflow'

interface InspectorProps {
  node: WorkflowNode | null
  project: ProjectContext
  onClose: () => void
  onUpdateNode: (id: string, patch: Partial<WorkflowNode['data']>) => void
  onUpdateProject: (project: ProjectContext) => void
}

export function Inspector({ node, project, onClose, onUpdateNode, onUpdateProject }: InspectorProps) {
  const [tab, setTab] = useState<'configure' | 'source'>('configure')
  if (!node) return null
  const sourcePath = node.data.subworkflow ? `workflows/${node.data.subworkflow.workflowId}.json` : `components/${node.data.templateId}.md`
  const updateSubworkflow = (patch: Partial<NonNullable<WorkflowNode['data']['subworkflow']>>) => {
    if (!node.data.subworkflow) return
    onUpdateNode(node.id, { subworkflow: { ...node.data.subworkflow, ...patch } })
  }

  return (
    <aside className="inspector-panel">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">Selected component</span>
          <h2>{node.data.label}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close inspector"><X size={17} /></button>
      </div>

      <div className="inspector-tabs">
        <button className={tab === 'configure' ? 'active' : ''} onClick={() => setTab('configure')}><Settings2 size={14} /> Configure</button>
        <button className={tab === 'source' ? 'active' : ''} onClick={() => setTab('source')}><FileText size={14} /> Source</button>
      </div>

      <div className="inspector-scroll">
        {tab === 'configure' ? <>
        <section className="form-section">
          <h3><SlidersHorizontal size={14} /> Instance</h3>
          <label>
            <span>Name</span>
            <input
              value={node.data.label}
              onChange={(event) => onUpdateNode(node.id, { label: event.target.value })}
            />
          </label>
          <label>
            <span>Purpose in this workflow</span>
            <textarea
              rows={3}
              value={node.data.description}
              onChange={(event) => onUpdateNode(node.id, { description: event.target.value })}
            />
          </label>
        </section>

        {node.data.subworkflow && <section className="form-section nested-workflow-settings">
          <h3><Layers3 size={14} /> Nested workflow</h3>
          <div className="nested-workflow-id"><span>Workflow reference</span><code>{node.data.subworkflow.workflowId}</code></div>
          <label><span>Execution boundary</span><select value={node.data.subworkflow.execution} onChange={(event) => updateSubworkflow({ execution: event.target.value as NonNullable<WorkflowNode['data']['subworkflow']>['execution'] })}><option value="isolated">Isolated child run</option><option value="inline">Inline in parent run</option></select></label>
          <label><span>Context passed</span><select value={node.data.subworkflow.context} onChange={(event) => updateSubworkflow({ context: event.target.value as NonNullable<WorkflowNode['data']['subworkflow']>['context'] })}><option value="inherit">Inherit parent context</option><option value="mapped">Mapped inputs only</option><option value="none">Objective only</option></select></label>
          <label><span>If child workflow fails</span><select value={node.data.subworkflow.onFailure} onChange={(event) => updateSubworkflow({ onFailure: event.target.value as NonNullable<WorkflowNode['data']['subworkflow']>['onFailure'] })}><option value="bubble">Fail parent step</option><option value="pause">Pause for decision</option><option value="continue">Continue with failure artifact</option></select></label>
          <p className="form-hint">The compiler resolves this workflow recursively and rejects self-reference or any unbounded dependency cycle.</p>
        </section>}

        <section className="form-section">
          <h3><Braces size={14} /> Project context</h3>
          <label>
            <span>Project name</span>
            <input
              value={project.name}
              onChange={(event) => onUpdateProject({ ...project, name: event.target.value })}
            />
          </label>
          <label>
            <span>Repository root</span>
            <input
              value={project.root}
              onChange={(event) => onUpdateProject({ ...project, root: event.target.value })}
            />
          </label>
          <label>
            <span>Check command</span>
            <input
              value={project.variables['commands.check'] ?? ''}
              onChange={(event) => onUpdateProject({
                ...project,
                variables: { ...project.variables, 'commands.check': event.target.value },
              })}
            />
          </label>
          <p className="form-hint">Values replace matching <code>{'{{variables}}'}</code> when a run is compiled.</p>
        </section>

        <section className="form-section">
          <button className="source-link" onClick={() => setTab('source')}>
            <span><FileText size={15} /> {sourcePath}</span>
            <ChevronRight size={15} />
          </button>
          <label>
            <span>Instruction override</span>
            <textarea
              className="instruction-editor"
              rows={12}
              value={node.data.instruction}
              onChange={(event) => onUpdateNode(node.id, { instruction: event.target.value })}
            />
          </label>
          <p className="form-hint">This edits only this node. The reusable Markdown component stays unchanged.</p>
        </section>
        </> : (
          <section className="form-section source-panel">
            <div className="source-file-heading">
              <FileText size={15} /> {sourcePath}
            </div>
            <pre>{node.data.subworkflow ? JSON.stringify({ type: 'workflow-reference', ...node.data.subworkflow }, null, 2) : `---\nid: ${node.data.templateId}\nname: ${node.data.label}\nkind: ${node.data.kind}\n---\n\n${node.data.instruction}`}</pre>
            <p className="form-hint">The source component is shared. Return to Configure to create an override for only this workflow node.</p>
          </section>
        )}
      </div>
    </aside>
  )
}
