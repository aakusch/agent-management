import type { ComponentKind, ComponentTemplate } from '../types/workflow'

const markdownFiles = import.meta.glob('../../components/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const parseList = (value: string | undefined) =>
  value?.split(',').map((item) => item.trim()).filter(Boolean) ?? []

function parseComponent(markdown: string): ComponentTemplate {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error('Component Markdown is missing frontmatter')

  const metadata = Object.fromEntries(
    match[1].split('\n').map((line) => {
      const separator = line.indexOf(':')
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
    }),
  )

  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    kind: metadata.kind as ComponentKind,
    icon: metadata.icon,
    color: metadata.color,
    version: metadata.version,
    tags: parseList(metadata.tags),
    inputs: parseList(metadata.inputs),
    outputs: parseList(metadata.outputs),
    instruction: match[2].trim(),
  }
}

export const componentLibrary = Object.values(markdownFiles)
  .map(parseComponent)
  .sort((a, b) => a.name.localeCompare(b.name))

export const componentById = Object.fromEntries(
  componentLibrary.map((component) => [component.id, component]),
)
