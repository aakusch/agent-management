import type { ComponentTemplate, WorkflowModuleDefinition } from '../types/workflow'

/** Modules come from the repository's `modules/` directory or an import — none are bundled. */
export const builtInModules: WorkflowModuleDefinition[] = []

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
