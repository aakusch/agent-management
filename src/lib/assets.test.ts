import { describe, expect, it } from 'vitest'
import { clearReview, markForReview, mergeParsedAssets, needsReview, parseAssetFile, parseComponentMarkdown, REVIEW_TAG } from './assets'

const component = `---
id: code-review
name: Code review
description: Reviews a diff for defects.
kind: judge
icon: scan
color: violet
version: 0.2.0
tags: review, quality
---

Read the diff and return a verdict.
`

describe('parseComponentMarkdown', () => {
  it('reads frontmatter and the instruction body', () => {
    const parsed = parseComponentMarkdown(component)
    expect(parsed).toMatchObject({
      id: 'code-review',
      name: 'Code review',
      kind: 'judge',
      version: '0.2.0',
      tags: ['review', 'quality'],
      instruction: 'Read the diff and return a verdict.',
    })
  })

  it('accepts CRLF line endings', () => {
    expect(parseComponentMarkdown(component.replace(/\n/g, '\r\n')).id).toBe('code-review')
  })

  it('accepts a leading byte-order mark', () => {
    expect(parseComponentMarkdown(`\uFEFF${component}`).id).toBe('code-review')
  })

  it('accepts trailing spaces after a delimiter and no trailing newline', () => {
    const messy = '---  \nid: a\nname: A\nkind: agent\n---   \nDo the thing.'
    expect(parseComponentMarkdown(messy).instruction).toBe('Do the thing.')
  })

  it('keeps colons that appear inside a value', () => {
    const withColon = '---\nid: a\nname: A\ndescription: Checks this: and that\nkind: agent\n---\nGo.\n'
    expect(parseComponentMarkdown(withColon).description).toBe('Checks this: and that')
  })

  it('ignores blank and malformed frontmatter lines instead of inventing keys', () => {
    const withNoise = '---\nid: a\n\nnot a pair\nname: A\nkind: agent\n---\nGo.\n'
    const parsed = parseComponentMarkdown(withNoise)
    expect(parsed.name).toBe('A')
    expect(Object.keys(parsed)).not.toContain('not a pai')
  })

  it('falls back to the filename for a missing id', () => {
    const withoutId = '---\nname: A\nkind: agent\n---\nGo.\n'
    expect(parseComponentMarkdown(withoutId, 'repo-orientation').id).toBe('repo-orientation')
  })

  it('defaults presentation fields an author omitted', () => {
    const minimal = parseComponentMarkdown('---\nid: a\nname: A\nkind: tool\n---\nGo.\n')
    expect(minimal).toMatchObject({ icon: 'bot', color: 'mint', version: '0.1.0', tags: [] })
  })

  it('names every missing required field', () => {
    expect(() => parseComponentMarkdown('---\nname: A\nkind: agent\n---\nGo.\n')).toThrow(/missing id/)
    expect(() => parseComponentMarkdown('---\nid: a\nkind: agent\n---\nGo.\n')).toThrow(/name/)
    expect(() => parseComponentMarkdown('---\nid: a\nname: A\nkind: agent\n---\n\n')).toThrow(/instruction body/)
  })

  it('rejects a kind that is not authorable', () => {
    expect(() => parseComponentMarkdown('---\nid: a\nname: A\nkind: catalyst\n---\nGo.\n')).toThrow(/kind/)
    expect(() => parseComponentMarkdown('---\nid: a\nname: A\nkind: wizard\n---\nGo.\n')).toThrow(/wizard/)
  })

  it('rejects markdown with no frontmatter at all', () => {
    expect(() => parseComponentMarkdown('# Just a heading\n')).toThrow(/frontmatter/)
  })
})

describe('parseAssetFile', () => {
  it('reads a markdown component and takes its id from the filename', () => {
    const assets = parseAssetFile('repo-orientation.md', '---\nname: Repo orientation\nkind: agent\n---\nMap the repo.\n')
    expect(assets.components).toHaveLength(1)
    expect(assets.components[0].id).toBe('repo-orientation')
  })

  it('sorts a relay.assets bundle into its three collections', () => {
    const bundle = JSON.stringify({
      kind: 'relay.assets',
      components: [{ id: 'a', name: 'A', description: '', kind: 'agent', icon: 'bot', color: 'mint', version: '1.0.0', tags: [], instruction: 'Go.' }],
      modules: [{ id: 'm', name: 'M', description: '', version: '1.0.0', icon: 'layers', color: 'cyan', tags: [], source: 'user', nodes: [{ id: 'n', componentId: 'a', position: { x: 0, y: 0 } }], edges: [], entryNodeIds: ['n'], exitNodeIds: ['n'] }],
    })
    const assets = parseAssetFile('bundle.json', bundle)
    expect(assets.components).toHaveLength(1)
    expect(assets.modules).toHaveLength(1)
    expect(assets.modules[0].source).toBe('user')
  })

  it('reports which entry of an array was invalid', () => {
    expect(() => parseAssetFile('list.json', '[{"nope":true}]')).toThrow(/list.json entry 1/)
  })

  it('rejects a bundle that carries nothing', () => {
    expect(() => parseAssetFile('empty.json', '{"kind":"relay.assets","components":[]}')).toThrow(/does not contain any/)
  })

  it('rejects malformed JSON with the filename', () => {
    expect(() => parseAssetFile('broken.json', '{oops')).toThrow(/broken.json is not valid JSON/)
  })
})

describe('review tagging', () => {
  it('marks once, reports, and clears', () => {
    const asset = { tags: ['quality'] }
    const marked = markForReview(asset)
    expect(needsReview(marked)).toBe(true)
    expect(markForReview(marked)).toBe(marked)
    expect(clearReview(marked).tags).toEqual(['quality'])
    expect(clearReview(marked).tags).not.toContain(REVIEW_TAG)
  })
})

describe('mergeParsedAssets', () => {
  it('concatenates every collection', () => {
    const merged = mergeParsedAssets([
      { components: [{ id: 'a' }], modules: [], templates: [] },
      { components: [{ id: 'b' }], modules: [{ id: 'm' }], templates: [] },
    ] as never)
    expect(merged.components).toHaveLength(2)
    expect(merged.modules).toHaveLength(1)
  })
})
