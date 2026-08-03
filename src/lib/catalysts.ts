import type { CatalystDefinition } from '../types/catalog'

const humanize = (value: string) => value
  .replaceAll(/[._-]/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

export const describeCatalyst = (catalyst: CatalystDefinition) => {
  const settings = catalyst.settings
  if (!settings) return catalyst.selector
  if (catalyst.kind === 'cron') {
    const cadence = settings.frequency === 'weekdays' ? 'Every weekday' : settings.frequency === 'daily' ? 'Every day' : settings.frequency === 'weekly' ? 'Every week' : 'Every hour'
    return settings.frequency === 'hourly' ? `${cadence} · ${settings.timezone}` : `${cadence} at ${settings.time} · ${settings.timezone}`
  }
  if (catalyst.kind === 'signed-webhook') return `${humanize(settings.provider)} · ${humanize(settings.webhookEvent)}`
  if (catalyst.kind === 'connector-event') return `${humanize(settings.connector)} · ${humanize(settings.connectorEvent)}`
  return `${humanize(settings.request)} · ${humanize(settings.scope)}`
}
