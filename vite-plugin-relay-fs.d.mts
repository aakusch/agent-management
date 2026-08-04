import type { Plugin } from 'vite'

/** Dev-only bridge that persists workspace assets into the repository's asset directories. */
export declare function relayFilesystem(): Plugin
