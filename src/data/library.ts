import type { ComponentTemplate } from '../types/workflow'

/**
 * Relay ships with no components. The workspace is filled from the repository's `components/`
 * directory through the dev filesystem bridge, by import, or by composing them in the app.
 */
export const componentLibrary: ComponentTemplate[] = []

export const platformComponents: ComponentTemplate[] = [{
  id: 'catalyst',
  name: 'Catalyst',
  description: 'Begin from a verified hook, connector event, schedule, or secure query.',
  kind: 'catalyst',
  icon: 'zap',
  color: 'amber',
  version: 'platform',
  tags: ['entrypoint', 'trigger', 'webhook', 'schedule'],
  inputs: ['verified event'],
  outputs: ['validated payload', 'provenance'],
  instruction: '',
}]
