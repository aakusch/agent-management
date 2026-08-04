import { describe, expect, it } from 'vitest'
// @ts-expect-error -- the dev bridge is plain ESM with no type declarations of its own.
import { safeTarget } from '../vite-plugin-relay-fs.mjs'

const root = '/repo'

describe('safeTarget', () => {
  it('resolves a plain asset file inside every allowed directory', () => {
    expect(safeTarget(root, 'components', 'code-review.md')).toBe('/repo/components/code-review.md')
    expect(safeTarget(root, 'modules', 'checks.json')).toBe('/repo/modules/checks.json')
    expect(safeTarget(root, 'templates', 'release.json')).toBe('/repo/templates/release.json')
    expect(safeTarget(root, 'workflows', 'flow.json')).toBe('/repo/workflows/flow.json')
    // Catalyst definitions are file-backed so a separate receiver process can read them.
    expect(safeTarget(root, 'catalysts', 'pr-check.json')).toBe('/repo/catalysts/pr-check.json')
  })

  it('refuses a directory that is not an asset directory', () => {
    expect(safeTarget(root, 'src', 'App.tsx')).toBeNull()
    expect(safeTarget(root, '', 'a.json')).toBeNull()
    expect(safeTarget(root, '../..', 'a.json')).toBeNull()
  })

  it('refuses path traversal and nested paths in the name', () => {
    expect(safeTarget(root, 'components', '../../etc/passwd')).toBeNull()
    expect(safeTarget(root, 'components', 'nested/a.md')).toBeNull()
    expect(safeTarget(root, 'components', 'nested\\a.md')).toBeNull()
  })

  it('refuses dotfiles and unexpected extensions', () => {
    expect(safeTarget(root, 'components', '.env')).toBeNull()
    expect(safeTarget(root, 'components', '.hidden.md')).toBeNull()
    expect(safeTarget(root, 'components', 'script.sh')).toBeNull()
    expect(safeTarget(root, 'components', 'noextension')).toBeNull()
  })

  it('refuses an empty name', () => {
    expect(safeTarget(root, 'components', '')).toBeNull()
  })
})
