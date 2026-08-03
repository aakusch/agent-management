import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Accessibility,
  Bot,
  Bug,
  Check,
  CircleUserRound,
  Eye,
  FileCheck2,
  GitFork,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  TerminalSquare,
  WandSparkles,
  Workflow,
  Zap,
  X,
} from 'lucide-react'
import type { WorkflowNode as WorkflowNodeType } from '../types/workflow'

const icons = {
  wand: WandSparkles,
  bot: Bot,
  shield: ShieldCheck,
  accessibility: Accessibility,
  bug: Bug,
  workflow: Workflow,
  scan: ScanSearch,
  eye: Eye,
  terminal: TerminalSquare,
  split: GitFork,
  'user-check': CircleUserRound,
  'file-check': FileCheck2,
  zap: Zap,
} as const

export function WorkflowNode({ data, selected }: NodeProps<WorkflowNodeType>) {
  const Icon = icons[data.icon as keyof typeof icons] ?? Bot
  const statusIcon = data.status === 'running'
    ? <LoaderCircle className="spin" size={18} />
    : data.status === 'passed'
      ? <Check size={18} />
      : data.status === 'failed'
        ? <X size={18} />
        : null
  const kindLabel: Record<string, string> = {
    agent: 'Agent', judge: 'Judge', tool: 'Tool', router: 'Logic', human: 'Approval', module: 'Module', workflow: 'Workflow', catalyst: 'Catalyst',
  }

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
