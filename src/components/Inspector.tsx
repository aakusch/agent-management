import { Braces, ChevronRight, FileText, Settings2, SlidersHorizontal, X } from 'lucide-react'
import type { ProjectContext, WorkflowNode } from '../types/workflow'

interface InspectorProps {
  node: WorkflowNode | null
  project: ProjectContext
  onClose: () => void
  onUpdateNode: (id: string, patch: Partial<WorkflowNode['data']>) => void
  onUpdateProject: (project: ProjectContext) => void
}

export function Inspector({ node, project, onClose, onUpdateNode, onUpdateProject }: InspectorProps) {
  if (!node) return null

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
        <button className="active"><Settings2 size={14} /> Configure</button>
        <button><FileText size={14} /> Source</button>
      </div>

      <div className="inspector-scroll">
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
          <button className="source-link">
            <span><FileText size={15} /> components/{node.data.templateId}.md</span>
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
      </div>
    </aside>
  )
}
