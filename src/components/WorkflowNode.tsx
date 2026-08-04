import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Check, LoaderCircle, X } from 'lucide-react'
import { iconFor } from '../lib/componentIcons'
import type { WorkflowNode as WorkflowNodeType } from '../types/workflow'

const kindLabel: Record<string, string> = {
  agent: 'Agent', judge: 'Judge', tool: 'Tool', router: 'Logic', human: 'Approval', module: 'Module', workflow: 'Workflow', catalyst: 'Catalyst',
}

export function WorkflowNode({ data, selected }: NodeProps<WorkflowNodeType>) {
  const Icon = iconFor(data.icon)
  const statusIcon = data.status === 'running'
    ? <LoaderCircle className="spin" size={18} />
    : data.status === 'passed'
      ? <Check size={18} />
      : data.status === 'failed'
        ? <X size={18} />
        : null

  return (
    <div
      className={`workflow-node kind-${data.kind} tone-${data.color} status-${data.status} ${selected ? 'is-selected' : ''}`}
      aria-label={`${data.label} workflow component`}
    >
      {data.kind !== 'catalyst' && <>
        <Handle id="target-left" type="target" position={Position.Left} className="node-handle" />
        <Handle id="target-bottom" type="target" position={Position.Bottom} className="node-handle node-handle-bottom" />
      </>}
      <div className="node-heading">
        <span className="node-icon"><Icon size={18} strokeWidth={1.8} /></span>
        <span className="node-title">{data.label}</span>
        <span className="node-status">{statusIcon}</span>
      </div>
      <p className="node-description">{data.result || data.description}</p>
      {data.kind === 'module' && <div className="module-node-composition" aria-label="Reusable component composition"><i /><span /><i /><span /><i /><em>linked graph</em></div>}
      {data.kind === 'workflow' && <div className="workflow-node-nesting" aria-label="Nested saved workflow"><i /><span /><i /><span /><i /><em>nested flow</em></div>}
      <div className="node-meta">
        <span className="node-kind-badge">{kindLabel[data.kind] ?? data.kind}</span>
        {data.tokens && <><i /> <span>{data.tokens}</span></>}
        {data.runtime && <><i /> <span>{data.runtime}</span></>}
      </div>
      <Handle id="source-right" type="source" position={Position.Right} className="node-handle" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className="node-handle node-handle-bottom" />
    </div>
  )
}
