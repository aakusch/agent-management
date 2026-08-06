import type { ComponentKind, ComponentTemplate, WorkflowModuleDefinition } from '../types/workflow'
import type { WorkflowTemplate } from '../types/catalog'
import { isRecord } from './storage'
import { isComponentTemplate, isWorkflowModuleDefinition, isWorkflowTemplate, templateKinds } from './validation'

/**
 * Assets an agent (or a teammate) authored elsewhere land in the workspace unreviewed. The tag is
 * carried on the asset's own tag list so nothing in the stored schema has to change, and it clears
 * the first time the user saves the asset from its editor.
 */
export const REVIEW_TAG = 'needs-review'
export const needsReview = (asset: { tags: string[] }) => asset.tags.includes(REVIEW_TAG)
export const markForReview = <T extends { tags: string[] }>(asset: T): T =>
  needsReview(asset) ? asset : { ...asset, tags: [...asset.tags, REVIEW_TAG] }
export const clearReview = <T extends { tags: string[] }>(asset: T): T =>
  needsReview(asset) ? { ...asset, tags: asset.tags.filter((tag) => tag !== REVIEW_TAG) } : asset

const parseList = (value: string | undefined) =>
  value?.split(',').map((item) => item.trim()).filter(Boolean) ?? []

/**
 * Components are authored as Markdown with frontmatter — the format agents are asked to emit.
 *
 * Tolerant on purpose about what does not change meaning (a BOM, CRLF endings, trailing spaces after
 * a delimiter, a missing trailing newline, blank lines inside the frontmatter) and strict about what
 * does: a component with no id, name, kind, or instruction is reported rather than half-imported.
 * `fallbackId` lets `components/<id>.md` supply the id the frontmatter omitted.
 */
export function parseComponentMarkdown(markdown: string, fallbackId?: string): ComponentTemplate {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const match = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/)
  if (!match) throw new Error('Component Markdown is missing its --- frontmatter block')

  const metadata: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    if (key) metadata[key] = line.slice(separator + 1).trim()
  }

  const instruction = (match[2] ?? '').trim()
  const component: ComponentTemplate = {
    id: metadata.id || fallbackId || '',
    name: metadata.name || '',
    description: metadata.description || '',
    kind: (metadata.kind || 'agent') as ComponentKind,
    icon: metadata.icon || 'bot',
    color: metadata.color || 'mint',
    version: metadata.version || '0.1.0',
    tags: parseList(metadata.tags),
    instruction,
  }
  const outcomes = parseList(metadata.outcomes)
  if (outcomes.length) component.outcomes = outcomes

  const missing = [
    !component.id && 'id',
    !component.name && 'name',
    !templateKinds.has(component.kind) && `kind (got "${metadata.kind}")`,
    !instruction && 'an instruction body below the frontmatter',
  ].filter((item): item is string => Boolean(item))
  if (missing.length) throw new Error(`Component Markdown is missing ${missing.join(', ')}`)
  return component
}

export interface ParsedAssets {
  components: ComponentTemplate[]
  modules: WorkflowModuleDefinition[]
  templates: WorkflowTemplate[]
}

const empty = (): ParsedAssets => ({ components: [], modules: [], templates: [] })
const total = (assets: ParsedAssets) => assets.components.length + assets.modules.length + assets.templates.length

const sortAsset = (value: unknown, into: ParsedAssets, label: string) => {
  if (isComponentTemplate(value)) into.components.push(value)
  else if (isWorkflowModuleDefinition(value)) into.modules.push({ ...value, source: 'user' })
  else if (isWorkflowTemplate(value)) into.templates.push(value)
  else throw new Error(`${label} is not a valid component, module, or template.`)
}

/**
 * Accepts every shape an author might hand over: a component Markdown file, one asset as JSON, an
 * array of assets, a `relay.assets` bundle, or an exported `relay.assignment` (whose payload
 * already carries the components and modules a workflow depends on).
 */
export function parseAssetFile(fileName: string, text: string): ParsedAssets {
  const assets = empty()

  if (fileName.toLowerCase().endsWith('.md')) {
    const component = parseComponentMarkdown(text, fileName.replace(/\.md$/i, ''))
    if (!isComponentTemplate(component)) throw new Error(`${fileName} is missing required component frontmatter.`)
    assets.components.push(component)
    return assets
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${fileName} is not valid JSON or Markdown.`)
  }

  if (Array.isArray(parsed)) {
    parsed.forEach((item, index) => sortAsset(item, assets, `${fileName} entry ${index + 1}`))
    return assets
  }

  if (isRecord(parsed) && (parsed.kind === 'relay.assets' || parsed.kind === 'relay.assignment')) {
    const bundle = parsed as { components?: unknown; modules?: unknown; templates?: unknown }
    const sections: Array<[unknown, string]> = [
      [bundle.components, 'component'],
      [bundle.modules, 'module'],
      [bundle.templates, 'template'],
    ]
    for (const [section, label] of sections) {
      if (section === undefined) continue
      if (!Array.isArray(section)) throw new Error(`${fileName} has an invalid ${label} list.`)
      section.forEach((item, index) => sortAsset(item, assets, `${fileName} ${label} ${index + 1}`))
    }
    if (!total(assets)) throw new Error(`${fileName} does not contain any components, modules, or templates.`)
    return assets
  }

  sortAsset(parsed, assets, fileName)
  return assets
}

export function mergeParsedAssets(files: ParsedAssets[]): ParsedAssets {
  return files.reduce<ParsedAssets>((merged, item) => ({
    components: [...merged.components, ...item.components],
    modules: [...merged.modules, ...item.modules],
    templates: [...merged.templates, ...item.templates],
  }), empty())
}

export function describeAssets(assets: ParsedAssets) {
  const parts: string[] = []
  if (assets.components.length) parts.push(`${assets.components.length} component${assets.components.length === 1 ? '' : 's'}`)
  if (assets.modules.length) parts.push(`${assets.modules.length} module${assets.modules.length === 1 ? '' : 's'}`)
  if (assets.templates.length) parts.push(`${assets.templates.length} template${assets.templates.length === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

/** The contract handed to an agent so what it writes imports cleanly. */
export const AGENT_AUTHORING_SPEC = `# Relay asset authoring

Write assets Relay can import directly. One JSON file may hold a single asset, an array, or a
bundle: { "kind": "relay.assets", "components": [], "modules": [], "templates": [] }

## Component (one job an agent performs) — .md with frontmatter, or JSON with the same fields
---
id: kebab-case-id
name: Human name
description: One sentence on what it does.
kind: agent | judge | router | tool | human
icon: wand | bot | scan | eye | terminal | split | shield | user-check | accessibility | bug | file-check | workflow | layers
color: mint | blue | violet | amber | coral | rose | cyan
version: 0.1.0
tags: comma, separated
---
The instruction the runner sends to the agent. State the job, the evidence it must gather, and the
exact verdict or artifact it must return. Keep project paths and run objectives out of it.

There is no port contract to declare. What crosses a step boundary is decided per transition.

## Module (a reusable graph of components) — JSON
{
  "id": "kebab-case-id", "name": "...", "description": "...", "version": "0.1.0",
  "icon": "layers", "color": "cyan", "tags": [], "source": "user",
  "nodes": [{ "id": "step-1", "componentId": "<component id>", "position": { "x": 0, "y": 0 }, "description": "..." }],
  "edges": [{ "id": "step-1-step-2", "source": "step-1", "target": "step-2",
              "data": { "trigger": "always", "handoff": "summary" } }],
  "entryNodeIds": ["step-1"], "exitNodeIds": ["step-2"]
}
Node positions are canvas coordinates on a 24px grid. Every edge endpoint must be a node id in the
same module, and entry/exit ids must exist in nodes.

### Transition data
- trigger: "always" | "condition" (with "condition": "route == pass") | "human"
- handoff: "summary" (previous agent briefs the next) | "full" (everything it produced) | "signal" (no context)
- label: optional text drawn on the connection
- tone: "default" | "success" | "danger" | "warning"
- loop: optional and bounded — { "mode": "bounded", "maxIterations": 3, "maxDurationMinutes": 30,
  "stopOnNoProgress": 2, "onExhausted": "human" }

## Template (a starting point that carries its own assets) — JSON
{
  "id": "kebab-case-id", "name": "...", "description": "...", "level": "Guided" | "Advanced",
  "steps": ["module name in order"], "componentIds": [], "moduleIds": ["<module id>"],
  "source": "community", "published": false,
  "assets": { "components": [ ...components... ], "modules": [ ...modules... ] }
}
Assets embedded in a template are cloned into the workspace when the template is used, so a
template works on a fresh install with an empty library.

Imported assets arrive tagged "needs-review" and must be opened and saved before they are trusted.
`
