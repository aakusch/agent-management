#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const [, , command, fileArg, ...rawArgs] = process.argv

function options(args) {
  const result = {}
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index]
    if (!item.startsWith('--')) continue
    // `--key=value` as well as `--key value`, so values that begin with `-` still arrive intact.
    const equals = item.indexOf('=')
    if (equals > 2) {
      result[item.slice(2, equals)] = item.slice(equals + 1)
      continue
    }
    const key = item.slice(2)
    const next = args[index + 1]
    result[key] = next !== undefined && !next.startsWith('--') ? next : true
    if (result[key] !== true) index += 1
  }
  return result
}

/** A flag that must carry a value — `--name` with nothing after it parses as `true`, not a name. */
const text = (value) => typeof value === 'string' ? value.trim() : ''

function fail(message) {
  process.stderr.write(`relay-workflow: ${message}\n`)
  process.exitCode = 1
}

function help() {
  process.stdout.write(`Relay workflow authoring\n\n`)
  process.stdout.write(`  relay-workflow create <file> --name <name> [--project-root <path>]\n`)
  process.stdout.write(`  relay-workflow inspect <file>\n`)
  process.stdout.write(`  relay-workflow add-node <file> --id <id> --name <label> --component <id> [--kind ${NODE_KINDS.join('|')}] [--module <module-id>] [--instruction <text>]\n`)
  process.stdout.write(`  relay-workflow connect <file> --from <node> --to <node> [--label <label>] [--condition <expression>] [--loop <count>] [--handoff summary|full|signal]\n`)
  process.stdout.write(`  relay-workflow validate <file>\n`)
  process.stdout.write(`  relay-workflow stage <file> --objective <prompt> [--autonomy guided|adaptive|autonomous] [--execution execute|dry-run] [--specification adaptive|exact] [--out <file>]\n`)
  process.stdout.write(`\nFlags accept --key value or --key=value.\n`)
}

async function load(file) {
  return JSON.parse(await readFile(resolve(file), 'utf8'))
}

async function save(file, value) {
  const target = resolve(file)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`)
}

const NODE_KINDS = ['agent', 'judge', 'router', 'human', 'tool', 'module', 'workflow', 'catalyst']
const HANDOFFS = ['signal', 'summary', 'full']

/**
 * Mirrors `isWorkflowDocument` in the app. Keeping the two in step matters: the CLI is what agents
 * run, and a graph that passes here but fails there is silently dropped when the workspace loads it.
 */
function validate(workflow) {
  const errors = []
  if (workflow?.schemaVersion !== '1.0') errors.push('schemaVersion must be 1.0')
  if (!workflow?.id || !workflow?.name) errors.push('id and name are required')
  if (!workflow?.project || !Array.isArray(workflow?.nodes) || !Array.isArray(workflow?.edges)) {
    errors.push('project, nodes, and edges are required')
    return errors
  }
  const nodeIds = new Set()
  for (const node of workflow.nodes) {
    if (!node?.id || nodeIds.has(node.id)) errors.push(`node id is missing or duplicated: ${node?.id ?? '<missing>'}`)
    nodeIds.add(node?.id)
    if (!node?.data?.templateId || !node?.data?.kind) {
      errors.push(`node ${node?.id} needs a component and kind`)
      continue
    }
    if (!NODE_KINDS.includes(node.data.kind)) errors.push(`node ${node.id} has an unknown kind "${node.data.kind}" (expected ${NODE_KINDS.join(', ')})`)
    if (node.type !== 'workflow') errors.push(`node ${node.id} must have type "workflow"`)
    if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) errors.push(`node ${node.id} needs a finite x/y position`)
    if (node.data.kind === 'module' && !node.data.module?.moduleId) errors.push(`node ${node.id} is a module and must name its moduleId`)
  }
  const edgeIds = new Set()
  for (const edge of workflow.edges) {
    if (!edge?.id || edgeIds.has(edge.id)) errors.push(`edge id is missing or duplicated: ${edge?.id ?? '<missing>'}`)
    edgeIds.add(edge?.id)
    if (!nodeIds.has(edge?.source) || !nodeIds.has(edge?.target)) errors.push(`edge ${edge?.id} references a missing node`)
    const handoff = edge?.data?.handoff
    if (handoff !== undefined && !HANDOFFS.includes(handoff)) errors.push(`edge ${edge.id} has an unknown handoff "${handoff}" (expected ${HANDOFFS.join(', ')})`)
    if (edge?.data?.loop && !['bounded', 'until-cancelled'].includes(edge.data.loop.mode)) errors.push(`edge ${edge.id} has an unknown loop mode "${edge.data.loop.mode}"`)
  }
  const catalysts = workflow.nodes.filter((node) => node?.data?.kind === 'catalyst')
  if (catalysts.length > 1) errors.push('only one catalyst is allowed')
  if (catalysts[0] && (workflow.entry?.mode !== 'catalyst' || workflow.entry?.nodeId !== catalysts[0].id)) errors.push('catalyst must be the declared entry node')
  if (catalysts[0] && workflow.edges.some((edge) => edge?.target === catalysts[0].id)) errors.push('the catalyst is the starting point and cannot receive a transition')
  if (!catalysts.length && workflow.entry?.mode === 'catalyst') errors.push('entry mode is "catalyst" but the graph has no catalyst node')
  return errors
}

async function main() {
  if (!command || ['help', '--help', '-h'].includes(command)) return help()
  if (!fileArg) return fail('a workflow file is required')
  const flags = options(rawArgs)

  if (command === 'create') {
    const name = text(flags.name)
    if (!name) return fail('--name is required and must carry a value')
    const id = text(flags.id) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (!id) return fail('--name has no letters or digits to build an id from; pass --id explicitly')
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
  if (!workflow || typeof workflow !== 'object' || !Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) {
    return fail(`${resolve(fileArg)} is not a Relay workflow document (it needs nodes and edges arrays)`)
  }
  if (command === 'inspect') {
    process.stdout.write(`${workflow.name} (${workflow.id})\n${workflow.nodes.length} nodes · ${workflow.edges.length} transitions · ${workflow.entry?.mode ?? 'manual'} entry\n`)
    for (const node of workflow.nodes) process.stdout.write(`  ${node.id}: ${node.data?.label ?? '<unnamed>'} [${node.data?.kind ?? '<no kind>'}]\n`)
    return
  }
  if (command === 'validate') {
    const errors = validate(workflow)
    if (errors.length) return fail(errors.join('\n  - '))
    process.stdout.write(`Valid Relay workflow: ${workflow.nodes.length} nodes, ${workflow.edges.length} transitions\n`)
    return
  }
  if (command === 'add-node') {
    const id = text(flags.id)
    const name = text(flags.name)
    const component = text(flags.component)
    if (!id || !name || !component) return fail('--id, --name, and --component are required and must carry values')
    if (workflow.nodes.some((node) => node?.id === id)) return fail(`node ${id} already exists`)
    const kind = text(flags.kind) || 'agent'
    // Why: an unknown kind produced a document the app silently refused to load. Reject it here.
    if (!NODE_KINDS.includes(kind)) return fail(`--kind must be one of ${NODE_KINDS.join(', ')}`)
    const moduleId = text(flags.module) || undefined
    if (kind === 'module' && !moduleId) return fail('--kind module also requires --module <module-id>')
    const index = workflow.nodes.length
    workflow.nodes.push({
      id, type: 'workflow', position: { x: 40 + (index % 3) * 390, y: 100 + Math.floor(index / 3) * 260 },
      data: {
        label: name, description: text(flags.description), templateId: component, kind,
        icon: text(flags.icon) || (moduleId ? 'layers' : 'bot'), color: text(flags.color) || 'mint', status: 'idle', instruction: text(flags.instruction), overrides: {}, execution: {},
        module: moduleId ? { moduleId, version: text(flags.version) || '1.0.0', mode: 'linked' } : undefined,
      },
    })
    if (kind === 'catalyst') workflow.entry = { mode: 'catalyst', nodeId: id }
    workflow.updatedAt = new Date().toISOString()
    await save(fileArg, workflow)
    process.stdout.write(`Added node ${id}\n`)
    return
  }
  if (command === 'connect') {
    const from = text(flags.from)
    const to = text(flags.to)
    if (!workflow.nodes.some((node) => node?.id === from) || !workflow.nodes.some((node) => node?.id === to)) return fail('--from and --to must reference existing nodes')
    const catalyst = workflow.nodes.find((node) => node?.data?.kind === 'catalyst')
    if (catalyst && catalyst.id === to) return fail('a catalyst is the starting point and cannot receive a transition')
    const id = text(flags.id) || `${from}-${to}`
    if (workflow.edges.some((edge) => edge?.id === id)) return fail(`transition ${id} already exists`)
    const condition = text(flags.condition) || undefined
    const handoff = text(flags.handoff) || 'summary'
    if (!HANDOFFS.includes(handoff)) return fail(`--handoff must be ${HANDOFFS.join(', ')}`)
    // Why: `Number('abc')` is NaN and `Number(true)` is 1, so an unparsable or valueless --loop used
    // to write a loop with no real bound — the one thing loops are supposed to guarantee.
    let loopCount
    if (flags.loop !== undefined) {
      loopCount = Number(text(flags.loop))
      if (!Number.isInteger(loopCount) || loopCount < 1) return fail('--loop must be a whole number of passes, 1 or more')
    }
    workflow.edges.push({
      id, source: from, target: to, type: 'workflow',
      data: {
        label: text(flags.label) || undefined, trigger: condition ? 'condition' : 'always', condition,
        tone: loopCount ? 'danger' : 'default', handoff,
        loop: loopCount ? { mode: 'bounded', maxIterations: loopCount, stopOnNoProgress: 2, onExhausted: 'human' } : undefined,
      },
    })
    workflow.updatedAt = new Date().toISOString()
    await save(fileArg, workflow)
    process.stdout.write(`Connected ${from} -> ${to}\n`)
    return
  }
  if (command === 'stage') {
    const objective = text(flags.objective)
    if (!objective) return fail('--objective is required and must carry a value')
    const errors = validate(workflow)
    if (errors.length) return fail(`workflow is invalid\n  - ${errors.join('\n  - ')}`)
    const autonomy = text(flags.autonomy) || 'adaptive'
    const execution = text(flags.execution) || 'execute'
    const specificationMode = text(flags.specification) || 'adaptive'
    if (!['guided', 'adaptive', 'autonomous'].includes(autonomy)) return fail('--autonomy must be guided, adaptive, or autonomous')
    if (!['execute', 'dry-run'].includes(execution)) return fail('--execution must be execute or dry-run')
    if (!['adaptive', 'exact'].includes(specificationMode)) return fail('--specification must be adaptive or exact')
    const runId = text(flags.id) || `run-${Date.now()}`
    // `--out` with no value parsed as `true` and wrote a file literally named "true".
    const output = text(flags.out) || `.relay/runs/staged/${runId}.json`
    await save(output, {
      kind: 'relay.staged-run', schemaVersion: '1.0', id: runId, workflow: resolve(fileArg), objective,
      configuration: { autonomy, execution, specificationMode },
      specification: { phase: 0, componentId: 'workflow-specifier', artifact: `.relay/runs/${runId}/run-spec.json`, status: 'pending' },
      createdAt: new Date().toISOString(), preparedBy: 'agent',
    })
    process.stdout.write(`Staged ${resolve(output)}\n`)
    return
  }
  fail(`unknown command: ${command}`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
