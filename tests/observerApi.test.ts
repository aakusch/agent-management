import { fork, type ChildProcess } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Verifies the live-observation contract in `docs/DRIVER-PROTOCOL.md` against a real HTTP server:
 * SSE envelopes, `Last-Event-ID` resume, capability-token enforcement, and operator controls.
 *
 * The Runs board consumes exactly these frames, so this is the transport half of "streaming works".
 */
const runner = new URL('../bin/relay-mock-runner.mjs', import.meta.url).pathname

interface Envelope {
  protocol: string
  seq: number
  time: string
  runId: string
  type: string
  nodeId?: string
  agentId?: string
  attempt?: number
  payload?: Record<string, unknown>
}

let child: ChildProcess
let base: string
let token: string
const runId = 'run-transport'

/** Reads SSE frames until `stop` is satisfied or the deadline passes. */
async function readStream(url: string, headers: Record<string, string>, stop: (events: Envelope[]) => boolean, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const response = await fetch(url, { headers, signal: controller.signal })
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toContain('text/event-stream')

  const events: Envelope[] = []
  const names: string[] = []
  const ids: string[] = []
  let buffer = ''
  try {
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    while (!stop(events)) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        for (const line of frame.split('\n')) {
          if (line.startsWith('data: ')) events.push(JSON.parse(line.slice(6)))
          if (line.startsWith('event: ')) names.push(line.slice(7))
          if (line.startsWith('id: ')) ids.push(line.slice(4))
        }
        boundary = buffer.indexOf('\n\n')
      }
    }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'AbortError') throw error
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
  return { events, names, ids }
}

beforeEach(async () => {
  child = fork(runner, ['--run', runId, '--interval', '15', '--quiet'], { stdio: 'ignore', serialization: 'json' })
  const ready = await new Promise<{ base: string; token: string }>((resolve, reject) => {
    child.once('message', (message) => resolve(message as { base: string; token: string }))
    child.once('error', reject)
    setTimeout(() => reject(new Error('the mock runner did not start')), 8000)
  })
  base = ready.base
  token = ready.token
})

afterEach(() => { child.kill('SIGTERM') })

const streamUrl = () => `${base}/v1/runs/${runId}/events`
const bearer = () => ({ Authorization: `Bearer ${token}` })

describe('observer API', () => {
  it('binds loopback only', () => {
    expect(base.startsWith('http://127.0.0.1:')).toBe(true)
  })

  it('requires a capability token on the stream and on control requests', async () => {
    expect((await fetch(streamUrl())).status).toBe(401)
    expect((await fetch(`${streamUrl()}?token=wrong`)).status).toBe(401)
    expect((await fetch(`${base}/v1/runs/${runId}/pause`, { method: 'POST' })).status).toBe(401)
  })

  it('accepts the token in a signed stream URL, the way EventSource must send it', async () => {
    const { events } = await readStream(`${streamUrl()}?token=${token}`, {}, (received) => received.length >= 1)
    expect(events[0].protocol).toBe('relay-events-v1')
  })

  it('streams envelopes that match the declared shape', async () => {
    const { events, names, ids } = await readStream(streamUrl(), bearer(), (received) => received.some((event) => event.type === 'node.completed'))
    for (const event of events) {
      expect(event.protocol).toBe('relay-events-v1')
      expect(event.runId).toBe(runId)
      expect(typeof event.seq).toBe('number')
      expect(Number.isNaN(Date.parse(event.time))).toBe(false)
      expect(typeof event.type).toBe('string')
      expect(event.payload).toBeTypeOf('object')
    }
    // Named SSE events and ids carry the type and the sequence number, as the transport section says.
    expect(names).toEqual(events.map((event) => event.type))
    expect(ids).toEqual(events.map((event) => String(event.seq)))
  })

  it('numbers events monotonically from 1 with no gaps', async () => {
    const { events } = await readStream(streamUrl(), bearer(), (received) => received.some((event) => event.type === 'run.completed'))
    expect(events.map((event) => event.seq)).toEqual(events.map((_, index) => index + 1))
  })

  it('runs the specification preflight before entering the graph', async () => {
    const { events } = await readStream(streamUrl(), bearer(), (received) => received.some((event) => event.type === 'run.started'))
    const types = events.map((event) => event.type)
    expect(types.indexOf('specification.completed')).toBeGreaterThan(types.indexOf('specification.started'))
    expect(types.indexOf('run.started')).toBeGreaterThan(types.indexOf('specification.completed'))
    expect(events.find((event) => event.type === 'specification.started')?.nodeId).toBe('__specification__')
  })

  it('carries the node, agent, and attempt provenance the board renders', async () => {
    const { events } = await readStream(streamUrl(), bearer(), (received) => received.some((event) => event.type === 'agent.tool.completed'))
    const started = events.find((event) => event.type === 'node.started')
    expect(started).toMatchObject({ nodeId: 'repo-orientation', attempt: 1 })
    expect(events.find((event) => event.type === 'agent.spawned')?.agentId).toBe('agent-01')
    expect(events.find((event) => event.type === 'agent.tool.started')?.payload).toMatchObject({ tool: 'terminal', command: 'git ls-files' })
  })

  it('emits the concurrency events the codebase view needs', async () => {
    const { events } = await readStream(streamUrl(), bearer(), (received) => received.some((event) => event.type === 'resource.released'))
    expect(events.map((event) => event.type)).toContain('resource.locked')
  })

  it('replays only the gap after Last-Event-ID', async () => {
    const first = await readStream(streamUrl(), bearer(), (received) => received.length >= 5)
    const resumeFrom = first.events[2].seq
    const second = await readStream(streamUrl(), { ...bearer(), 'Last-Event-ID': String(resumeFrom) }, (received) => received.length >= 2)
    expect(second.events[0].seq).toBe(resumeFrom + 1)
    expect(second.events.every((event) => event.seq > resumeFrom)).toBe(true)
  })

  it('honours pause, resume, and cancel and reports each as an event', async () => {
    await readStream(streamUrl(), bearer(), (received) => received.length >= 3)

    const paused = await fetch(`${base}/v1/runs/${runId}/pause`, { method: 'POST', headers: bearer() })
    expect(paused.ok).toBe(true)
    const afterPause = await readStream(streamUrl(), bearer(), (received) => received.some((event) => event.type === 'run.paused'), 2000)
    expect(afterPause.events.some((event) => event.type === 'run.paused')).toBe(true)

    expect((await fetch(`${base}/v1/runs/${runId}/resume`, { method: 'POST', headers: bearer() })).ok).toBe(true)
    const afterResume = await readStream(streamUrl(), bearer(), (received) => received.some((event) => event.type === 'run.resumed'), 2000)
    expect(afterResume.events.some((event) => event.type === 'run.resumed')).toBe(true)

    expect((await fetch(`${base}/v1/runs/${runId}/cancel`, { method: 'POST', headers: bearer() })).ok).toBe(true)
    const afterCancel = await readStream(streamUrl(), bearer(), (received) => received.some((event) => event.type === 'run.cancelled'), 2000)
    expect(afterCancel.events.some((event) => event.type === 'run.cancelled')).toBe(true)
  })

  it('serves derived run state and rejects unknown runs and verbs', async () => {
    const state = await fetch(`${base}/v1/runs/${runId}`, { headers: bearer() })
    expect(state.ok).toBe(true)
    expect(await state.json()).toMatchObject({ runId })
    expect((await fetch(`${base}/v1/runs/other/events`, { headers: bearer() })).status).toBe(404)
    expect((await fetch(`${base}/v1/runs/${runId}/teleport`, { method: 'POST', headers: bearer() })).status).toBe(405)
  })
})
