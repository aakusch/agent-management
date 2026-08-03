import { CheckCircle2, Map, Maximize2 } from 'lucide-react'

interface WorkflowToolbarProps {
  minimapVisible: boolean
  onFitView: () => void
  onValidate: () => void
  onToggleMinimap: () => void
}

export function WorkflowToolbar({ minimapVisible, onFitView, onValidate, onToggleMinimap }: WorkflowToolbarProps) {
  return <div className="workflow-tools" aria-label="Canvas tools">
    <div className="workflow-tool-rail">
      <button type="button" data-tooltip="Fit view" onClick={onFitView} aria-label="Fit workflow to view"><Maximize2 size={16} /></button>
      <button type="button" data-tooltip="Validate graph" onClick={onValidate} aria-label="Validate workflow"><CheckCircle2 size={16} /></button>
      <button type="button" data-tooltip={minimapVisible ? 'Hide minimap' : 'Show minimap'} className={minimapVisible ? 'active' : ''} onClick={onToggleMinimap} aria-label={`${minimapVisible ? 'Hide' : 'Show'} minimap`}><Map size={16} /></button>
    </div>
  </div>
}
