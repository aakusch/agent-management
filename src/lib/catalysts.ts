import type { CatalystDefinition } from '../types/catalog'

const humanize = (value: string) => value
  .replaceAll(/[._-]/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

/**
 * A one-line summary of what starts this catalyst.
 *
 * Falls back to the selector whenever the settings a kind depends on are absent — an imported or
 * partially written definition otherwise rendered as "Every week at undefined · undefined".
 */
export const describeCatalyst = (catalyst: CatalystDefinition) => {
  const settings = catalyst.settings
  if (!settings) return catalyst.selector
  const pair = (first?: string, second?: string) =>
    first && second ? `${humanize(first)} · ${humanize(second)}` : catalyst.selector

  if (catalyst.kind === 'cron') {
    if (!settings.frequency || !settings.timezone) return catalyst.selector
    const cadence = { weekdays: 'Every weekday', daily: 'Every day', weekly: 'Every week', hourly: 'Every hour' }[settings.frequency]
    if (!cadence) return catalyst.selector
    if (settings.frequency === 'hourly') return `${cadence} · ${settings.timezone}`
    return settings.time ? `${cadence} at ${settings.time} · ${settings.timezone}` : `${cadence} · ${settings.timezone}`
  }
  if (catalyst.kind === 'signed-webhook') return pair(settings.provider, settings.webhookEvent)
  if (catalyst.kind === 'connector-event') return pair(settings.connector, settings.connectorEvent)
  return pair(settings.request, settings.scope)
}
