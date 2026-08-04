import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseComponentMarkdown } from './assets'
import { componentToMarkdown, readWorkspaceFiles, serializeModule, syncCollection } from './workspaceFiles'
import type { ComponentTemplate } from '../types/workflow'

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
