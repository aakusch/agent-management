import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseComponentMarkdown } from './assets'
import { componentToMarkdown, readWorkspaceFiles, serializeDocument, serializeModule, syncCollection } from './workspaceFiles'
import type { ComponentTemplate, WorkflowDocument } from '../types/workflow'

const component: ComponentTemplate = {
  id: 'code-review', name: 'Code review', description: 'Reviews a diff.', kind: 'judge',
  icon: 'scan', color: 'violet', version: '0.2.0', tags: ['review', 'quality'], instruction: 'Read the diff.\n\nReturn a verdict.',
}

afterEach(() => { vi.unstubAllGlobals() })

const stubFetch = (handler: (url: string, init?: RequestInit) => unknown) => {
  const calls: Array<{ method: string; body: unknown }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const result = handler(url, init)
    return result ?? { ok: true, json: async () => ({}) }
  }))
  return calls
}

describe('componentToMarkdown', () => {
  it('round-trips through the parser unchanged', () => {
    expect(parseComponentMarkdown(componentToMarkdown(component))).toEqual(component)
  })

  // Frontmatter values are single-line, so a pasted newline would write a file that no longer parses.
  it('flattens newlines pasted into a single-line field', () => {
    const messy = { ...component, name: 'Code\nreview', description: 'Reviews\n a diff.' }
    const parsed = parseComponentMarkdown(componentToMarkdown(messy))
    expect(parsed.name).toBe('Code review')
    expect(parsed.description).toBe('Reviews a diff.')
  })

  it('ends with exactly one trailing newline', () => {
    expect(componentToMarkdown(component).endsWith('verdict.\n')).toBe(true)
  })
})

describe('readWorkspaceFiles', () => {
  it('returns null when no dev bridge is listening', async () => {
    stubFetch(() => ({ ok: false }))
    expect(await readWorkspaceFiles()).toBeNull()
    vi.unstubAllGlobals()
    stubFetch(() => { throw new Error('ECONNREFUSED') })
    expect(await readWorkspaceFiles()).toBeNull()
  })

  it('parses each directory and reports the files it could not read', async () => {
    stubFetch(() => ({
      ok: true,
      json: async () => ({
        root: '/repo',
        files: [
          { dir: 'components', name: 'code-review.md', content: componentToMarkdown(component) },
          { dir: 'components', name: 'broken.md', content: 'no frontmatter here' },
          { dir: 'modules', name: 'checks.json', content: serializeModule({
            id: 'checks', name: 'Checks', description: '', version: '1.0.0', icon: 'layers', color: 'cyan', tags: [], source: 'user',
            nodes: [{ id: 'a', componentId: 'code-review', position: { x: 0, y: 0 } }], edges: [], entryNodeIds: ['a'], exitNodeIds: ['a'],
          }) },
        ],
      }),
    }))
    const workspace = await readWorkspaceFiles()
    expect(workspace?.root).toBe('/repo')
    expect(workspace?.components.map((item) => item.id)).toEqual(['code-review'])
    expect(workspace?.modules).toHaveLength(1)
    expect(workspace?.problems).toHaveLength(1)
    expect(workspace?.problems[0]).toMatch(/components\/broken.md/)
  })

  it('takes a component id from its filename when the frontmatter omits one', async () => {
    stubFetch(() => ({
      ok: true,
      json: async () => ({ root: '/repo', files: [{ dir: 'components', name: 'repo-orientation.md', content: '---\nname: Repo orientation\nkind: agent\n---\nMap it.\n' }] }),
    }))
    expect((await readWorkspaceFiles())?.components[0].id).toBe('repo-orientation')
  })

  it('keeps the first of two files claiming the same id and says so', async () => {
    const markdown = componentToMarkdown(component)
    stubFetch(() => ({
      ok: true,
      json: async () => ({ root: '/repo', files: [
        { dir: 'components', name: 'code-review.md', content: markdown },
        { dir: 'components', name: 'copy.md', content: markdown },
      ] }),
    }))
    const workspace = await readWorkspaceFiles()
    expect(workspace?.components).toHaveLength(1)
    expect(workspace?.problems[0]).toMatch(/defined more than once/)
  })
})

describe('syncCollection', () => {
  const serialize = (item: { id: string; value?: string }) => `${item.id}:${item.value ?? ''}`

  it('writes only what changed', async () => {
    const calls = stubFetch(() => ({ ok: true }))
    await syncCollection('modules', [{ id: 'a', value: '1' }, { id: 'b', value: '2' }], [{ id: 'a', value: '1' }], serialize)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method: 'PUT', body: { dir: 'modules', name: 'b.json', content: 'b:2' } })
  })

  it('rewrites an item whose content changed', async () => {
    const calls = stubFetch(() => ({ ok: true }))
    await syncCollection('modules', [{ id: 'a', value: '2' }], [{ id: 'a', value: '1' }], serialize)
    expect(calls).toMatchObject([{ method: 'PUT', body: { name: 'a.json', content: 'a:2' } }])
  })

  it('deletes what disappeared, using the .md extension for components', async () => {
    const calls = stubFetch(() => ({ ok: true }))
    await syncCollection('components', [], [{ id: 'gone' }], serialize)
    expect(calls).toMatchObject([{ method: 'DELETE', body: { dir: 'components', name: 'gone.md' } }])
  })

  it('writes nothing when the collection is unchanged', async () => {
    const calls = stubFetch(() => ({ ok: true }))
    await syncCollection('templates', [{ id: 'a', value: '1' }], [{ id: 'a', value: '1' }], serialize)
    expect(calls).toHaveLength(0)
  })

  it('reports the files it could not write or delete rather than failing silently', async () => {
    stubFetch((_url, init) => ({ ok: init?.method === 'DELETE' }))
    const problems = await syncCollection('workflows', [{ id: 'new' }], [{ id: 'old' }], serialize)
    expect(problems).toEqual(['workflows/new.json could not be written'])
  })

  it('survives a bridge that has gone away', async () => {
    stubFetch(() => { throw new Error('ECONNREFUSED') })
    const problems = await syncCollection('workflows', [{ id: 'new' }], [], serialize)
    expect(problems).toHaveLength(1)
  })
})

describe('serializeDocument', () => {
  const document = {
    schemaVersion: '1.0', id: 'flow', name: 'Flow', description: '', updatedAt: '2026-08-04T00:00:00.000Z',
    project: {
      name: 'Relay', root: '/repo', branch: 'main', variables: {},
      defaults: { model: 'auto', effort: 'medium', maxParallelAgents: 3, tools: ['git'] },
      permissions: { spawnAgents: true, shell: 'project', network: 'ask', publish: 'ask' },
    },
    nodes: [{
      id: 'a', type: 'workflow', position: { x: 0, y: 0 },
      measured: { width: 304, height: 156 }, selected: true, dragging: false, width: 304, height: 156,
      data: { label: 'A', description: '', templateId: 'c', kind: 'agent', icon: 'bot', color: 'mint', status: 'idle', instruction: '', overrides: {} },
    }],
    edges: [{ id: 'a-a', source: 'a', target: 'a', type: 'workflow', selected: true, data: { handoff: 'summary' } }],
  } as unknown as WorkflowDocument

  // Why: viewport state made every save rewrite the file, so opening a workflow produced a diff.
  it('drops the runtime layout and selection React Flow adds', () => {
    const written = JSON.parse(serializeDocument(document))
    expect(written.nodes[0]).not.toHaveProperty('measured')
    expect(written.nodes[0]).not.toHaveProperty('selected')
    expect(written.nodes[0]).not.toHaveProperty('dragging')
    expect(written.nodes[0]).not.toHaveProperty('width')
    expect(written.edges[0]).not.toHaveProperty('selected')
  })

  it('keeps the graph itself intact', () => {
    const written = JSON.parse(serializeDocument(document))
    expect(written.nodes[0]).toMatchObject({ id: 'a', type: 'workflow', position: { x: 0, y: 0 } })
    expect(written.nodes[0].data).toMatchObject({ label: 'A', templateId: 'c', kind: 'agent' })
    expect(written.edges[0]).toMatchObject({ id: 'a-a', source: 'a', target: 'a', data: { handoff: 'summary' } })
  })

  it('ends with a newline so the file is a well-formed text file', () => {
    expect(serializeDocument(document).endsWith('\n')).toBe(true)
  })
})
