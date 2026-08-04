export function readStored<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    return validate(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

/**
 * Reads a stored collection, keeping the entries that still validate.
 *
 * Why: `readStored` is all-or-nothing, so one asset written by an older build (or a hand-edited
 * file) used to discard the user's whole library. Per-item filtering loses only the bad entry.
 */
export function readStoredItems<T>(key: string, validate: (value: unknown) => value is T): T[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(validate) : []
  } catch {
    return []
  }
}

export function writeStored(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeStored(key: string): boolean {
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isString = (value: unknown): value is string => typeof value === 'string'

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString)

