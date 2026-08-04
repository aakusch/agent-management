import { describe, expect, it } from 'vitest'
import { instanceId, slugify, uniqueId } from './ids'

describe('slugify', () => {
  it('lowercases and joins words with single dashes', () => {
    expect(slugify('My Release Workflow')).toBe('my-release-workflow')
    expect(slugify('UI   quality   loop')).toBe('ui-quality-loop')
  })

  it('drops leading and trailing separators', () => {
    expect(slugify('  --Release!!  ')).toBe('release')
  })

  it('returns empty for a name with no alphanumerics', () => {
    expect(slugify('!!!')).toBe('')
    expect(slugify('')).toBe('')
  })
})

describe('uniqueId', () => {
  const taken = (...ids: string[]) => (candidate: string) => ids.includes(candidate)

  it('uses the plain slug when it is free', () => {
    expect(uniqueId('Release check', taken())).toBe('release-check')
  })

  it('suffixes past every collision instead of overwriting', () => {
    expect(uniqueId('Release', taken('release'))).toBe('release-2')
    expect(uniqueId('Release', taken('release', 'release-2', 'release-3'))).toBe('release-4')
  })

  it('falls back rather than producing an empty id', () => {
    expect(uniqueId('!!!', taken(), 'module')).toBe('module')
    expect(uniqueId('???', taken('module'), 'module')).toBe('module-2')
  })
})

describe('instanceId', () => {
  it('never repeats within a single millisecond', () => {
    const ids = Array.from({ length: 500 }, () => instanceId('code-review'))
    expect(new Set(ids).size).toBe(500)
  })

  it('keeps the prefix so ids stay readable', () => {
    expect(instanceId('edge').startsWith('edge-')).toBe(true)
  })
})
