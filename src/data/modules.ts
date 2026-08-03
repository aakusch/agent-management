import type { ComponentTemplate, WorkflowEdgeData, WorkflowModuleDefinition } from '../types/workflow'

interface ModuleAsset extends Omit<WorkflowModuleDefinition, 'source' | 'edges'> {
  edges: Array<{
    id?: string
    source: string
    target: string
    label?: string
    tone?: WorkflowEdgeData['tone']
    condition?: string
    handoff?: boolean
    loop?: WorkflowEdgeData['loop']
  }>
}

const moduleFiles = import.meta.glob('../../modules/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const structuredHandoff: NonNullable<WorkflowEdgeData['handoff']> = {
  mode: 'structured',
  required: true,
  include: ['artifacts', 'decisions', 'verification', 'risks', 'open_questions', 'next_action'],
  onMissing: 'auto-summary',
}

const parseModuleFile = (raw: string): WorkflowModuleDefinition[] => {
  const assets = JSON.parse(raw) as ModuleAsset[]
  return assets.map((asset) => ({
    ...asset,
    source: 'built-in',
    edges: asset.edges.map((item, index) => ({
      id: item.id ?? `${item.source}-${item.target}-${index + 1}`,
      source: item.source,
      target: item.target,
      data: {
        label: item.label,
        tone: item.tone ?? 'default',
        trigger: item.condition ? 'condition' : 'always',
        condition: item.condition,
        payload: { mode: 'all' },
        onBlocked: 'wait',
        handoff: item.handoff ? structuredHandoff : undefined,
        loop: item.loop,
      },
    })),
  }))
}

export const builtInModules = Object.values(moduleFiles)
  .flatMap(parseModuleFile)
  .sort((a, b) => a.name.localeCompare(b.name))

export const moduleComponentTemplates = (modules: WorkflowModuleDefinition[]): ComponentTemplate[] => modules.map((module) => ({
  id: `module-${module.id}`,
  moduleId: module.id,
  name: module.name,
  description: module.description,
  kind: 'module',
  icon: module.icon,
  color: module.color,
  version: module.version,
  tags: [...module.tags, 'module', 'reusable'],
  inputs: module.inputs,
  outputs: module.outputs,
  instruction: '',
}))
