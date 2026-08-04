#!/usr/bin/env node
/**
 * A mock Relay runner that implements the observer API from `docs/DRIVER-PROTOCOL.md`.
 *
 * It executes nothing. Its only job is to prove the live-observation contract end to end: it binds
 * loopback-only, mints a short-lived capability token, streams `relay-events-v1` frames over SSE, and
 * honours the operator control endpoints. Use it to verify the Runs board — and as the fixture the
 * transport tests drive — until the real driver exists.
 *
 *   node bin/relay-mock-runner.mjs --run run-1 --port 4317 --nodes implement,review
 *
 * It prints the signed stream URL to paste into the Runs board's "Observer URL" field.
 */
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const flags = {}
for (let index = 0; index < process.argv.length; index += 1) {
  const item = process.argv[index]
  if (!item.startsWith('--')) continue
  const equals = item.indexOf('=')
  if (equals > 2) { flags[item.slice(2, equals)] = item.slice(equals + 1); continue }
  const next = process.argv[index + 1]
  flags[item.slice(2)] = next && !next.startsWith('--') ? next : true
}

const runId = typeof flags.run === 'string' ? flags.run : 'run-1'
const port = Number(flags.port) || 0
const token = typeof flags.token === 'string' ? flags.token : randomUUID()
const interval = Number(flags.interval) || 900
// `--quiet` keeps the transport tests from interleaving log lines with their own output.
const quiet = flags.quiet === true

// `--nodes first,second` replaces the placeholder node ids so the scripted run drives a real graph's
// nodes. Without it the board receives ids it cannot match and no node lights up.
const [firstNode = 'repo-orientation', secondNode = 'code-review'] = typeof flags.nodes === 'string'
  ? flags.nodes.split(',').map((item) => item.trim()).filter(Boolean)
  : []

/** The scripted run. Node ids match a graph staged from the builder's specification preflight. */
const script = [
  { type: 'run.created', payload: { status: 'created', summary: 'Assignment accepted' } },
  { type: 'specification.started', nodeId: '__specification__', payload: { summary: 'Reading project evidence' } },
  { type: 'specification.completed', nodeId: '__specification__', payload: { summary: 'Wrote run-spec.json', artifactIds: ['run-spec.json'] } },
  { type: 'run.started', payload: { status: 'running', summary: 'Entering the graph' } },
  { type: 'node.ready', nodeId: firstNode, payload: { summary: 'Dependencies satisfied' } },
  { type: 'node.started', nodeId: firstNode, attempt: 1, payload: { status: 'running', summary: 'Mapping the repository' } },
  { type: 'agent.spawned', nodeId: firstNode, agentId: 'agent-01', payload: { summary: 'Worker attached' } },
  { type: 'agent.tool.started', nodeId: firstNode, agentId: 'agent-01', payload: { tool: 'terminal', command: 'git ls-files' } },
  { type: 'agent.tool.completed', nodeId: firstNode, agentId: 'agent-01', payload: { tool: 'terminal', summary: '412 tracked files' } },
  { type: 'resource.locked', nodeId: firstNode, payload: { summary: 'src/lib write scope held' } },
  { type: 'artifact.created', nodeId: firstNode, payload: { summary: 'repo-map.md', artifactIds: ['repo-map.md'] } },
  { type: 'node.completed', nodeId: firstNode, payload: { status: 'passed', summary: 'Repository mapped' } },
  { type: 'resource.released', nodeId: firstNode, payload: { summary: 'src/lib write scope released' } },
  { type: 'route.selected', nodeId: firstNode, payload: { route: 'pass', summary: 'Continuing to review' } },
  { type: 'node.started', nodeId: secondNode, attempt: 1, payload: { status: 'running', summary: 'Reviewing the diff' } },
  { type: 'agent.spawned', nodeId: secondNode, agentId: 'agent-02', payload: { summary: 'Worker attached' } },
  { type: 'agent.heartbeat', nodeId: secondNode, agentId: 'agent-02', payload: { summary: 'Alive' } },
  { type: 'approval.requested', nodeId: secondNode, payload: { summary: 'Two findings need a decision' } },
  { type: 'approval.resolved', nodeId: secondNode, payload: { summary: 'Operator approved the fix plan' } },
  { type: 'node.completed', nodeId: secondNode, payload: { status: 'passed', summary: 'Review clean' } },
  { type: 'agent.stopped', agentId: 'agent-02', payload: { summary: 'Worker released' } },
  { type: 'agent.stopped', agentId: 'agent-01', payload: { summary: 'Worker released' } },
  { type: 'run.completed', payload: { status: 'completed', summary: 'Run finished' } },
]

const clients = new Set()
let sequence = 0
let cursor = 0
let paused = false
let cancelled = false
let timer

const log = (message) => { if (!quiet) process.stdout.write(`${message}\n`) }

function broadcast(event) {
  const frame = `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  for (const client of clients) client.write(frame)
}

/** Emits one envelope, assigning the durable sequence number `Last-Event-ID` resumes from. */
function emit(entry) {
  sequence += 1
  const event = {
    protocol: 'relay-events-v1',
    seq: sequence,
    time: new Date().toISOString(),
    runId,
    type: entry.type,
    ...(entry.nodeId ? { nodeId: entry.nodeId } : {}),
    ...(entry.attempt ? { attempt: entry.attempt } : {}),
    ...(entry.agentId ? { agentId: entry.agentId } : {}),
    payload: entry.payload ?? {},
  }
  history.push(event)
  broadcast(event)
  return event
}

const history = []

function tick() {
  if (cancelled || paused || cursor >= script.length) return
  emit(script[cursor])
  cursor += 1
  if (cursor < script.length) timer = setTimeout(tick, interval)
}

const authorized = (req, url) => {
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  return bearer === token || url.searchParams.get('token') === token || url.searchParams.get('access_token') === token
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  const path = url.pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' })
    return res.end()
  }
  if (!authorized(req, url)) return json(res, 401, { error: 'a capability token is required' })

  const prefix = `/v1/runs/${encodeURIComponent(runId)}`
  if (path !== prefix && !path.startsWith(`${prefix}/`)) return json(res, 404, { error: `unknown run for ${path}` })
  const action = path.slice(prefix.length).replace(/^\//, '')

  if (req.method === 'GET' && action === '') {
    return json(res, 200, { runId, status: cancelled ? 'cancelled' : paused ? 'paused' : cursor >= script.length ? 'completed' : 'running', seq: sequence })
  }

  if (req.method === 'GET' && action === 'events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    clients.add(res)
    // Last-Event-ID maps directly onto the sequence number, so a reconnect replays the gap only.
    const resumeFrom = Number(req.headers['last-event-id'] ?? url.searchParams.get('lastEventId') ?? 0)
    for (const event of history) {
      if (event.seq > resumeFrom) res.write(`id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    }
    req.on('close', () => clients.delete(res))
    if (!timer && !cursor) timer = setTimeout(tick, interval)
    log(`observer attached · resuming after seq ${resumeFrom}`)
    return undefined
  }

  if (req.method === 'POST' && ['pause', 'resume', 'cancel'].includes(action)) {
    if (action === 'pause' && !paused) { paused = true; clearTimeout(timer); timer = undefined; emit({ type: 'run.paused', payload: { status: 'paused', summary: 'Paused by operator' } }) }
    if (action === 'resume' && paused) { paused = false; emit({ type: 'run.resumed', payload: { status: 'running', summary: 'Resumed by operator' } }); timer = setTimeout(tick, interval) }
    if (action === 'cancel' && !cancelled) { cancelled = true; clearTimeout(timer); timer = undefined; emit({ type: 'run.cancelled', payload: { status: 'cancelled', summary: 'Cancelled by operator' } }) }
    return json(res, 200, { runId, action, accepted: true })
  }

  return json(res, 405, { error: `${req.method} ${path} is not part of the observer API` })
})

// Loopback only: the observer API is never exposed off the machine running the driver.
server.listen(port, '127.0.0.1', () => {
  const bound = server.address()
  const base = `http://127.0.0.1:${bound.port}`
  log(`Relay mock runner · ${script.length} scripted events for ${runId}`)
  log(`  observer   ${base}`)
  log(`  stream     ${base}/v1/runs/${encodeURIComponent(runId)}/events?token=${token}`)
  log(`  token      ${token}`)
  if (process.send) process.send({ ready: true, base, token, runId, events: script.length })
})

const shutdown = () => { clearTimeout(timer); for (const client of clients) client.end(); server.close(() => process.exit(0)) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
