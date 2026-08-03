#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const [, , command, fileArg, ...rawArgs] = process.argv

function options(args) {
  const result = {}
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index]
    if (!item.startsWith('--')) continue
    const key = item.slice(2)
    const next = args[index + 1]
    result[key] = next && !next.startsWith('--') ? next : true
    if (result[key] !== true) index += 1
  }
  return result
}

function fail(message) {
  process.stderr.write(`relay-workflow: ${message}\n`)
  process.exitCode = 1
}

function help() {
  process.stdout.write(`Relay workflow authoring\n\n`)
  process.stdout.write(`  relay-workflow create <file> --name <name> [--project-root <path>]\n`)
  process.stdout.write(`  relay-workflow inspect <file>\n`)
  process.stdout.write(`  relay-workflow add-node <file> --id <id> --name <label> --component <id> [--kind agent] [--module <module-id>] [--instruction <text>]\n`)
  process.stdout.write(`  relay-workflow connect <file> --from <node> --to <node> [--label <label>] [--condition <expression>] [--loop <count>] [--handoff structured]\n`)
  process.stdout.write(`  relay-workflow validate <file>\n`)
  process.stdout.write(`  relay-workflow stage <file> --objective <prompt> [--out <file>]\n`)
}

async function load(file) {
  return JSON.parse(await readFile(resolve(file), 'utf8'))
}

async function save(file, value) {
  const target = resolve(file)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`)
}

function validate(workflow) {
  const errors = []
  if (workflow?.schemaVersion !== '1.0') errors.push('schemaVersion must be 1.0')
  if (!workflow?.id || !workflow?.name) errors.push('id and name are required')
  if (!workflow?.project || !Array.isArray(workflow?.nodes) || !Array.isArray(workflow?.edges)) errors.push('project, nodes, and edges are required')
  const nodeIds = new Set()
  for (const node of workflow?.nodes ?? []) {
    if (!node.id || nodeIds.has(node.id)) errors.push(`node id is missing or duplicated: ${node.id ?? '<missing>'}`)
    nodeIds.add(node.id)
    if (!node.data?.templateId || !node.data?.kind) errors.push(`node ${node.id} needs a component and kind`)
  }
  const edgeIds = new Set()
  for (const edge of workflow?.edges ?? []) {
    if (!edge.id || edgeIds.has(edge.id)) errors.push(`edge id is missing or duplicated: ${edge.id ?? '<missing>'}`)
    edgeIds.add(edge.id)
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push(`edge ${edge.id} references a missing node`)
  }
  const catalysts = (workflow?.nodes ?? []).filter((node) => node.data?.kind === 'catalyst')
  if (catalysts.length > 1) errors.push('only one catalyst is allowed')
  if (catalysts[0] && (workflow.entry?.mode !== 'catalyst' || workflow.entry?.nodeId !== catalysts[0].id)) errors.push('catalyst must be the declared entry node')
  return errors
}

async function main() {
  if (!command || ['help', '--help', '-h'].includes(command)) return help()
  if (!fileArg) return fail('a workflow file is required')
  const flags = options(rawArgs)

  if (command === 'create') {
    const name = String(flags.name || '').trim()
    if (!name) return fail('--name is required')
    const id = String(flags.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
    const workflow = {
      schemaVersion: '1.0', id, name, description: String(flags.description || ''),
      project: {
        name: String(flags.project || 'Project'), root: String(flags['project-root'] || ''), branch: String(flags.branch || ''), variables: {},
        defaults: { model: 'auto', effort: 'medium', maxParallelAgents: 3, tools: ['filesystem', 'terminal', 'git'] },
        permissions: { spawnAgents: true, shell: 'project', network: 'ask', publish: 'ask' },
        profile: { status: 'not-scanned', structure: 'unknown', packageManager: 'auto', capabilities: [], instructions: ['AGENTS.md', 'CLAUDE.md'], commands: {} },
      },
      entry: { mode: 'manual' },
      specification: { enabled: true, componentId: 'workflow-specifier', mode: 'guided', artifact: 'run-spec.json', maySelectOptionalModules: true, mayBindProjectCommands: true, mayConfigureNodes: true, mayRemoveRequiredModules: false, mayWidenPermissions: false },
      nodes: [], edges: [], updatedAt: new Date().toISOString(),
    }
    await save(fileArg, workflow)
    process.stdout.write(`Created ${resolve(fileArg)}\n`)
    return
  }

  const workflow = await load(fileArg)
  if (command === 'inspect') {
    process.stdout.write(`${workflow.name} (${workflow.id})\n${workflow.nodes.length} nodes · ${workflow.edges.length} transitions · ${workflow.entry?.mode ?? 'manual'} entry\n`)
    for (const node of workflow.nodes) process.stdout.write(`  ${node.id}: ${node.data.label} [${node.data.kind}]\n`)
    return
  }
  if (command === 'validate') {
    const errors = validate(workflow)
    if (errors.length) return fail(errors.join('\n  - '))
    process.stdout.write(`Valid Relay workflow: ${workflow.nodes.length} nodes, ${workflow.edges.length} transitions\n`)
    return
  }
  if (command === 'add-node') {
    const id = String(flags.id || '').trim()
    const name = String(flags.name || '').trim()
    const component = String(flags.component || '').trim()
    if (!id || !name || !component) return fail('--id, --name, and --component are required')
    if (workflow.nodes.some((node) => node.id === id)) return fail(`node ${id} already exists`)
    const index = workflow.nodes.length
    const moduleId = flags.module ? String(flags.module) : undefined
    workflow.nodes.push({
      id, type: 'workflow', position: { x: 40 + (index % 3) * 390, y: 100 + Math.floor(index / 3) * 260 },
      data: {
        label: name, description: String(flags.description || ''), templateId: component, kind: String(flags.kind || 'agent'),
        icon: String(flags.icon || (moduleId ? 'workflow' : 'bot')), color: String(flags.color || 'mint'), status: 'idle', instruction: String(flags.instruction || ''), overrides: {}, execution: {},
        module: moduleId ? { moduleId, version: String(flags.version || '1.0.0'), mode: 'linked' } : undefined,
      },
    })
    workflow.updatedAt = new Date().toISOString()
    await save(fileArg, workflow)
    process.stdout.write(`Added node ${id}\n`)
    return
  }
  if (command === 'connect') {
    const from = String(flags.from || '').trim()
    const to = String(flags.to || '').trim()
    if (!workflow.nodes.some((node) => node.id === from) || !workflow.nodes.some((node) => node.id === to)) return fail('--from and --to must reference existing nodes')
    const id = String(flags.id || `${from}-${to}`)
    if (workflow.edges.some((edge) => edge.id === id)) return fail(`transition ${id} already exists`)
    const condition = flags.condition ? String(flags.condition) : undefined
    const loopCount = flags.loop ? Number(flags.loop) : undefined
    const handoffMode = flags.handoff ? String(flags.handoff) : undefined
    workflow.edges.push({
      id, source: from, target: to, type: 'workflow',
      data: {
        label: flags.label ? String(flags.label) : undefined, trigger: condition ? 'condition' : 'always', condition,
        tone: loopCount ? 'danger' : 'default', payload: { mode: 'all' }, onBlocked: 'wait',
        handoff: handoffMode ? { mode: handoffMode, required: true, include: ['artifacts', 'decisions', 'verification', 'risks', 'open_questions', 'next_action'], onMissing: 'auto-summary' } : undefined,
        loop: loopCount ? { mode: 'bounded', maxIterations: loopCount, stopOnNoProgress: 2, onExhausted: 'human' } : undefined,
      },
    })
    workflow.updatedAt = new Date().toISOString()
    await save(fileArg, workflow)
    process.stdout.write(`Connected ${from} -> ${to}\n`)
    return
  }
  if (command === 'stage') {
    const objective = String(flags.objective || '').trim()
    if (!objective) return fail('--objective is required')
    const errors = validate(workflow)
    if (errors.length) return fail(`workflow is invalid\n  - ${errors.join('\n  - ')}`)
    const runId = String(flags.id || `run-${Date.now()}`)
    const output = String(flags.out || `.relay/runs/staged/${runId}.json`)
    await save(output, {
      kind: 'relay.staged-run', schemaVersion: '1.0', id: runId, workflow: resolve(fileArg), objective,
      configuration: { autonomy: String(flags.autonomy || 'adaptive'), execution: String(flags.execution || 'execute'), specificationMode: String(flags.specification || 'adaptive') },
      specification: { phase: 0, componentId: 'workflow-specifier', artifact: `.relay/runs/${runId}/run-spec.json`, status: 'pending' },
      createdAt: new Date().toISOString(), preparedBy: 'agent',
    })
    process.stdout.write(`Staged ${resolve(output)}\n`)
    return
  }
  fail(`unknown command: ${command}`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
