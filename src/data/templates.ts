import type { WorkflowTemplate } from '../types/catalog'

const templateFiles = import.meta.glob('../../templates/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

export const builtInTemplates = Object.values(templateFiles)
  .flatMap((raw) => JSON.parse(raw) as WorkflowTemplate[])
  .sort((a, b) => a.name.localeCompare(b.name))
