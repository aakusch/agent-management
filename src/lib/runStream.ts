export type RelayEventType =
  | 'run.created'
  | 'run.started'
  | 'run.paused'
  | 'run.resumed'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled'
  | 'node.ready'
  | 'node.started'
  | 'node.output'
  | 'node.completed'
  | 'node.failed'
  | 'agent.spawned'
  | 'agent.heartbeat'
  | 'agent.tool.started'
  | 'agent.tool.completed'
  | 'agent.stopped'
  | 'route.selected'
  | 'loop.iterated'
  | 'loop.exhausted'
  | 'artifact.created'
  | 'approval.requested'
  | 'approval.resolved'
  | 'budget.warning'
  | 'policy.denied'

export interface RelayRunEvent {
  protocol: 'relay-events-v1'
  seq: number
  time: string
  runId: string
  type: RelayEventType
  nodeId?: string
  attempt?: number
  agentId?: string
  payload: Record<string, unknown>
}

interface RunStreamOptions {
  baseUrl: string
  runId: string
  token: string
  onEvent: (event: RelayRunEvent) => void
  onConnectionChange?: (connected: boolean) => void
}

/**
 * Loopback observer for the future local Relay driver. EventSource reconnects
 * automatically and sends Last-Event-ID, so the daemon can resume at the next
 * durable sequence number without the UI inventing state.
 */
export function connectRunStream({ baseUrl, runId, token, onEvent, onConnectionChange }: RunStreamOptions) {
  const url = new URL(`/v1/runs/${encodeURIComponent(runId)}/events`, baseUrl)
  url.searchParams.set('access_token', token)
  const stream = new EventSource(url)

  stream.onopen = () => onConnectionChange?.(true)
  stream.onerror = () => onConnectionChange?.(false)
  stream.onmessage = (message) => {
    const event = JSON.parse(message.data) as RelayRunEvent
    if (event.protocol === 'relay-events-v1' && event.runId === runId) onEvent(event)
  }

  return () => stream.close()
}
