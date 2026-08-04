import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isRecord, isStringArray, readStored, readStoredItems, removeStored, writeStored } from './storage'

const createStorage = () => {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: createStorage() })
})

const isNumber = (value: unknown): value is number => typeof value === 'number'

describe('readStored', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(readStored('missing', 7, isNumber)).toBe(7)
  })

  it('returns the fallback for malformed JSON or a failed guard', () => {
    window.localStorage.setItem('bad', '{oops')
    expect(readStored('bad', 7, isNumber)).toBe(7)
    window.localStorage.setItem('wrong', '"a string"')
    expect(readStored('wrong', 7, isNumber)).toBe(7)
  })

  it('round-trips a written value', () => {
    expect(writeStored('n', 12)).toBe(true)
    expect(readStored('n', 0, isNumber)).toBe(12)
  })
})

describe('readStoredItems', () => {
  // Regression: the all-or-nothing guard meant one stale asset wiped the user's whole library.
  it('keeps the valid entries and drops only the bad ones', () => {
    window.localStorage.setItem('items', JSON.stringify([1, 'two', 3, null, 4]))
    expect(readStoredItems('items', isNumber)).toEqual([1, 3, 4])
  })

  it('returns empty for a missing key, malformed JSON, or a non-array', () => {
    expect(readStoredItems('missing', isNumber)).toEqual([])
    window.localStorage.setItem('bad', '{oops')
    expect(readStoredItems('bad', isNumber)).toEqual([])
    window.localStorage.setItem('object', '{"a":1}')
    expect(readStoredItems('object', isNumber)).toEqual([])
  })
})

describe('write and remove under a hostile storage', () => {
  it('reports failure instead of throwing when storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('blocked') },
        setItem: () => { throw new Error('QuotaExceededError') },
        removeItem: () => { throw new Error('blocked') },
      },
    })
    expect(writeStored('n', 1)).toBe(false)
    expect(removeStored('n')).toBe(false)
    expect(readStored('n', 7, isNumber)).toBe(7)
    expect(readStoredItems('n', isNumber)).toEqual([])
  })
})

describe('guards', () => {
  it('isRecord accepts plain objects only', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('a')).toBe(false)
  })

  it('isStringArray requires every entry to be a string', () => {
    expect(isStringArray([])).toBe(true)
    expect(isStringArray(['a', 'b'])).toBe(true)
    expect(isStringArray(['a', 1])).toBe(false)
    expect(isStringArray('a')).toBe(false)
  })
})
