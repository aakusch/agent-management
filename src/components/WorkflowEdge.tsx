import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import type { WorkflowEdge as WorkflowEdgeType } from '../types/workflow'

export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
}: EdgeProps<WorkflowEdgeType>) {
  const [bezierPath, bezierLabelX, bezierLabelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.34,
  })
  const tone = data?.tone ?? 'default'
  const isReturnLoop = tone === 'danger' && targetX < sourceX
  const loopDepth = Math.max(sourceY, targetY) + 190
  const path = isReturnLoop
    ? `M ${sourceX},${sourceY} C ${sourceX},${loopDepth} ${targetX},${loopDepth} ${targetX},${targetY}`
    : bezierPath
  const labelX = isReturnLoop ? (sourceX + targetX) / 2 : bezierLabelX
  const labelY = isReturnLoop ? loopDepth - 18 : bezierLabelY

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={`workflow-edge edge-${tone} ${selected ? 'is-selected' : ''}`}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label edge-label-${tone}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
