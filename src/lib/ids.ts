/** Kebab-case identifier from a human name. Empty when the name carries no alphanumerics. */
export const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/**
 * A slug that is guaranteed non-empty and not already taken.
 *
 * Why: ids are derived from names everywhere (workflows, modules, components, templates, catalysts).
 * Without this, a punctuation-only name produced an empty id and a duplicate name silently
 * overwrote the existing asset.
 */
export function uniqueId(candidate: string, taken: (id: string) => boolean, fallback = 'item'): string {
  const base = slugify(candidate) || fallback
  if (!taken(base)) return base
  let suffix = 2
  while (taken(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

// Why: `Date.now()` alone collides when two nodes or edges are created inside the same millisecond
// (drag-drop bursts, module expansion), and duplicate ids make React Flow drop elements.
let sequence = 0
export const instanceId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(sequence += 1).toString(36)}`
