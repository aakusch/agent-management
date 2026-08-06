import type { ComponentTemplate, WorkflowDocument, WorkflowModuleDefinition } from '../types/workflow'
import type { CatalystDefinition, WorkflowTemplate } from '../types/catalog'
import { parseComponentMarkdown } from './assets'
import { isCatalystDefinition, isComponentTemplate, isWorkflowDocument, isWorkflowModuleDefinition, isWorkflowTemplate } from './validation'

/**
 * The repository directories are the source of truth when the dev bridge is running, so the CLI
 * (`relay-workflow`) and any agent editing files see exactly what the builder sees.
 */
const ENDPOINT = '/__relay/assets'
type AssetDir = 'components' | 'modules' | 'templates' | 'workflows' | 'catalysts'

interface AssetFile { dir: AssetDir; name: string; content: string }

export interface WorkspaceFiles {
  root: string
  components: ComponentTemplate[]
  modules: WorkflowModuleDefinition[]
  templates: WorkflowTemplate[]
  documents: WorkflowDocument[]
  /** Why file-backed: the receiver that authenticates events is a separate process and has to be
   *  able to read the definitions the workspace authored. localStorage is invisible to it. */
  catalysts: CatalystDefinition[]
  problems: string[]
}

const idFrom = (name: string) => name.replace(/\.(md|json)$/i, '')

/** Components round-trip as Markdown so they stay readable and diffable in the repo.
 *
 * Frontmatter values are single-line, so a newline pasted into a name or description would otherwise
 * write a file that no longer parses back.
 */
export function componentToMarkdown(component: ComponentTemplate): string {
  const line = (value: string) => value.replace(/\s*[\r\n]+\s*/g, ' ').trim()
  const frontmatter = [
    `id: ${line(component.id)}`,
    `name: ${line(component.name)}`,
    `description: ${line(component.description)}`,
    `kind: ${component.kind}`,
    `icon: ${component.icon}`,
    `color: ${component.color}`,
    `version: ${component.version}`,
    `tags: ${component.tags.map(line).filter(Boolean).join(', ')}`,
  ]
  // Only written when declared, so components that just succeed or fail stay unchanged.
  if (component.outcomes?.length) frontmatter.push(`outcomes: ${component.outcomes.map(line).filter(Boolean).join(', ')}`)
  return `---\n${frontmatter.join('\n')}\n---\n\n${component.instruction.trim()}\n`
}

/** Fires when the CLI, an agent, or git changes a file under the asset directories. */
export function onWorkspaceFilesChanged(handler: () => void): () => void {
  const hot = (import.meta as { hot?: { on: (event: string, cb: () => void) => void; off: (event: string, cb: () => void) => void } }).hot
  if (!hot) return () => undefined
  hot.on('relay:assets-changed', handler)
  return () => hot.off('relay:assets-changed', handler)
}

export async function readWorkspaceFiles(): Promise<WorkspaceFiles | null> {
  let payload: { root: string; files: AssetFile[] }
  try {
    const response = await fetch(ENDPOINT, { method: 'GET', cache: 'no-store' })
    if (!response.ok) return null
    payload = await response.json()
  } catch {
    return null
  }

  const workspace: WorkspaceFiles = { root: payload.root, components: [], modules: [], templates: [], documents: [], catalysts: [], problems: [] }
  for (const file of payload.files ?? []) {
    const label = `${file.dir}/${file.name}`
    try {
      if (file.dir === 'components') {
        const component = file.name.toLowerCase().endsWith('.md') ? parseComponentMarkdown(file.content, idFrom(file.name)) : JSON.parse(file.content)
        if (!isComponentTemplate(component)) throw new Error('missing required component fields')
        workspace.components.push(component)
        continue
      }
      const raw: unknown = JSON.parse(file.content)
      const parsed = raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as { kind?: string }).kind === 'relay.assignment'
        ? (raw as { workflow?: unknown }).workflow
        : raw
      const entries = Array.isArray(parsed) ? parsed : [parsed]
      for (const entry of entries) {
        if (file.dir === 'modules') {
          if (!isWorkflowModuleDefinition(entry)) throw new Error('invalid module definition')
          workspace.modules.push({ ...entry, source: 'user' })
        } else if (file.dir === 'templates') {
          if (!isWorkflowTemplate(entry)) throw new Error('invalid template definition')
          workspace.templates.push(entry)
        } else if (file.dir === 'catalysts') {
          if (!isCatalystDefinition(entry)) throw new Error('invalid catalyst definition')
          workspace.catalysts.push(entry)
        } else {
          if (!isWorkflowDocument(entry)) throw new Error('invalid workflow document')
          workspace.documents.push(entry)
        }
      }
    } catch (error) {
      workspace.problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  // Two files can claim the same id — an exported assignment bundle next to the plain document, for
  // instance. Keep the first and say so rather than showing the asset twice.
  const dedupe = <T extends { id: string }>(items: T[], label: string): T[] => {
    const byId = new Map<string, T>()
    for (const item of items) {
      if (byId.has(item.id)) {
        workspace.problems.push(`${label} "${item.id}" is defined more than once — the later file was ignored`)
        continue
      }
      byId.set(item.id, item)
    }
    return [...byId.values()]
  }
  workspace.components = dedupe(workspace.components, 'component')
  workspace.modules = dedupe(workspace.modules, 'module')
  workspace.templates = dedupe(workspace.templates, 'template')
  workspace.documents = dedupe(workspace.documents, 'workflow')
  workspace.catalysts = dedupe(workspace.catalysts, 'catalyst')
  return workspace
}

async function write(dir: AssetDir, name: string, content: string): Promise<boolean> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, name, content }),
    })
    return response.ok
  } catch {
    return false
  }
}

async function remove(dir: AssetDir, name: string): Promise<boolean> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, name }),
    })
    return response.ok
  } catch {
    return false
  }
}

const stringify = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

/**
 * Mirrors a collection to disk: writes what changed, deletes what disappeared. Called after every
 * mutation so an agent watching the repo sees the same state the browser holds.
 */
export async function syncCollection<T extends { id: string }>(
  dir: AssetDir,
  next: T[],
  previous: T[],
  serialize: (item: T) => string,
): Promise<string[]> {
  const extension = dir === 'components' ? '.md' : '.json'
  const fileName = (id: string) => `${id}${extension}`
  // Serialize each side once. The previous version was called twice per item on every comparison.
  const previousText = new Map(previous.map((item) => [item.id, serialize(item)]))
  const changed = next.reduce<Array<[string, string]>>((result, item) => {
    const text = serialize(item)
    if (previousText.get(item.id) !== text) result.push([item.id, text])
    return result
  }, [])
  const nextIds = new Set(next.map((item) => item.id))
  const removed = previous.filter((item) => !nextIds.has(item.id)).map((item) => item.id)

  const results = await Promise.all([
    ...changed.map(async ([id, text]) => await write(dir, fileName(id), text) ? null : `${dir}/${fileName(id)} could not be written`),
    ...removed.map(async (id) => await remove(dir, fileName(id)) ? null : `${dir}/${fileName(id)} could not be deleted`),
  ])
  return results.filter((item): item is string => item !== null)
}

/**
 * React Flow decorates the nodes it renders with measured sizes, drag state, and selection. None of
 * that belongs in a portable document: it made every save rewrite the file with viewport noise, so a
 * `git diff` after opening a workflow looked like a real edit.
 */
function withoutRuntimeState(document: WorkflowDocument): WorkflowDocument {
  return {
    ...document,
    nodes: document.nodes.map(({ measured, selected, dragging, width, height, ...node }) => {
      void measured; void selected; void dragging; void width; void height
      return node
    }),
    edges: document.edges.map(({ selected, ...item }) => {
      void selected
      return item
    }),
  }
}

export const serializeComponent = componentToMarkdown
export const serializeModule = (module: WorkflowModuleDefinition) => stringify(module)
export const serializeTemplate = (template: WorkflowTemplate) => stringify(template)
export const serializeDocument = (document: WorkflowDocument) => stringify(withoutRuntimeState(document))
export const serializeCatalyst = (catalyst: CatalystDefinition) => stringify(catalyst)
