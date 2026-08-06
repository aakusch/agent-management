import type { ComponentTemplate } from '../types/workflow'

/**
 * Relay bundles no authorable components. The workspace is filled from the repository's
 * `components/` directory through the dev filesystem bridge, by import, or by the in-app creator.
 *
 * Platform components are the exception: Relay configures and operates them rather than prompting
 * them as agents, so they are supplied here and cannot be edited or deleted.
 */
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
