import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

/**
 * Bridges the browser workspace to the repository directories the CLI and agents read.
 *
 * Without this, the app persists only to localStorage and `relay-workflow` can never see what was
 * authored in the builder. With it, every asset lives on disk as the single source of truth:
 *
 *   components/<id>.md   modules/<id>.json   templates/<id>.json   workflows/<id>.json
 *   catalysts/<id>.json
 *
 * Dev/preview only — a static build has no filesystem, and the app falls back to localStorage.
 */
const ASSET_DIRS = ['components', 'modules', 'templates', 'workflows', 'catalysts']
const ALLOWED_EXTENSIONS = new Set(['.md', '.json'])
const MAX_BYTES = 2 * 1024 * 1024

const isAssetDir = (value) => ASSET_DIRS.includes(value)

/** Refuses anything that escapes the asset directories or carries an unexpected extension. */
export function safeTarget(root, dir, name) {
  if (!isAssetDir(dir)) return null
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.')) return null
  if (!ALLOWED_EXTENSIONS.has(extname(name))) return null
  const target = resolve(root, dir, name)
  const base = resolve(root, dir)
  const rel = relative(base, target)
  return rel && !rel.startsWith('..') ? target : null
}

/**
 * Refuses a write that came from another site.
 *
 * Why: this endpoint writes files into the repository, and any page open in the same browser can
 * reach a dev server on localhost. A same-origin request from the workspace carries an `Origin` that
 * matches the host it was served from; a drive-by page carries its own. Requests with no `Origin` at
 * all (curl, the CLI, a test) are allowed — the header is what identifies a browser-driven caller.
 */
export function isSameOrigin(headers) {
  const origin = headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === headers.host
  } catch {
    return false
  }
}

async function readAssets(root) {
  const perDirectory = await Promise.all(ASSET_DIRS.map(async (dir) => {
    let names
    try {
      names = await readdir(resolve(root, dir), { withFileTypes: true })
    } catch {
      return []
    }
    // Read the directory's files concurrently — a serial loop made boot latency scale with the
    // library size. Directory entries are skipped so a nested folder cannot be sent as a file.
    return (await Promise.all(names.map(async (entry) => {
      if (!entry.isFile() || !ALLOWED_EXTENSIONS.has(extname(entry.name)) || entry.name.startsWith('.')) return null
      try {
        return { dir, name: entry.name, content: await readFile(resolve(root, dir, entry.name), 'utf8') }
      } catch {
        return null
      }
    }))).filter(Boolean)
  }))
  return perDirectory.flat()
}

const json = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function relayFilesystem() {
  return {
    name: 'relay-filesystem',
    apply: (_config, env) => env.command === 'serve',
    configureServer(server) {
      const root = server.config.root

      server.middlewares.use('/__relay/assets', (req, res) => {
        void (async () => {
          try {
            if (req.method === 'GET') {
              return json(res, 200, { root, files: await readAssets(root) })
            }

            if (req.method === 'PUT' || req.method === 'DELETE') {
              if (!isSameOrigin(req.headers)) return json(res, 403, { error: 'cross-origin writes are refused' })
              const chunks = []
              let size = 0
              for await (const chunk of req) {
                size += chunk.length
                if (size > MAX_BYTES) return json(res, 413, { error: 'asset is larger than the 2 MB limit' })
                chunks.push(chunk)
              }
              const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
              const target = safeTarget(root, String(body.dir ?? ''), String(body.name ?? ''))
              if (!target) return json(res, 400, { error: `dir must be one of ${ASSET_DIRS.join(', ')} and name a plain .md or .json file` })

              if (req.method === 'DELETE') {
                await rm(target, { force: true })
                return json(res, 200, { deleted: relative(root, target) })
              }
              if (typeof body.content !== 'string') return json(res, 400, { error: 'content must be a string' })
              await mkdir(dirname(target), { recursive: true })
              await writeFile(target, body.content.endsWith('\n') ? body.content : `${body.content}\n`)
              return json(res, 200, { written: relative(root, target) })
            }

            return json(res, 405, { error: `${req.method} is not supported` })
          } catch (error) {
            return json(res, 500, { error: error instanceof Error ? error.message : String(error) })
          }
        })()
      })

      // An agent (or the CLI) editing these files should show up in the open page, so notify the
      // client instead of triggering a module reload. Nothing imports these paths anymore.
      // Match on the directory separator: a bare prefix test also fired for sibling directories
      // such as `components-archive/`, reloading the workspace on unrelated edits.
      const watched = ASSET_DIRS.map((dir) => `${join(root, dir)}${sep}`)
      let pending
      server.watcher.add(ASSET_DIRS.map((dir) => join(root, dir)))
      server.watcher.on('all', (_event, file) => {
        if (!watched.some((dir) => file.startsWith(dir))) return
        clearTimeout(pending)
        pending = setTimeout(() => server.ws.send({ type: 'custom', event: 'relay:assets-changed' }), 120)
      })
      server.httpServer?.once('close', () => clearTimeout(pending))
    },
  }
}
