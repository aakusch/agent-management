import { describe, expect, it } from 'vitest'
import { describeCatalyst } from './catalysts'
import type { CatalystDefinition } from '../types/catalog'

const base: CatalystDefinition = {
  id: 'pr-check', name: 'PR check', kind: 'connector-event', selector: 'github.pull_request.opened',
  security: 'connector-oauth', status: 'awaiting-runner', createdAt: '2026-08-04T00:00:00.000Z',
}

describe('describeCatalyst', () => {
  it('describes a connector event', () => {
    expect(describeCatalyst({ ...base, settings: { connector: 'github', connectorEvent: 'pull_request.opened' } }))
      .toBe('Github · Pull Request Opened')
  })

  it('describes a signed webhook', () => {
    expect(describeCatalyst({ ...base, kind: 'signed-webhook', settings: { provider: 'stripe', webhookEvent: 'invoice.payment_failed' } }))
      .toBe('Stripe · Invoice Payment Failed')
  })

  it('describes a secure query', () => {
    expect(describeCatalyst({ ...base, kind: 'secure-query', settings: { request: 'repository-audit', scope: 'workspace' } }))
      .toBe('Repository Audit · Workspace')
  })

  it('describes each schedule cadence', () => {
    const cron = (settings: Record<string, string>) => describeCatalyst({ ...base, kind: 'cron', settings })
    expect(cron({ frequency: 'weekdays', time: '09:00', timezone: 'UTC' })).toBe('Every weekday at 09:00 · UTC')
    expect(cron({ frequency: 'daily', time: '07:30', timezone: 'UTC' })).toBe('Every day at 07:30 · UTC')
    expect(cron({ frequency: 'weekly', time: '08:00', timezone: 'UTC' })).toBe('Every week at 08:00 · UTC')
    expect(cron({ frequency: 'hourly', time: '08:00', timezone: 'UTC' })).toBe('Every hour · UTC')
  })

  // Regression: a partially written definition used to render "Every week at undefined · undefined".
  it('falls back to the selector when the settings a kind needs are missing', () => {
    expect(describeCatalyst({ ...base, settings: undefined })).toBe(base.selector)
    expect(describeCatalyst({ ...base, settings: {} })).toBe(base.selector)
    expect(describeCatalyst({ ...base, settings: { connector: 'github' } })).toBe(base.selector)
    expect(describeCatalyst({ ...base, kind: 'cron', settings: { frequency: 'weekly', timezone: 'UTC' } })).toBe('Every week · UTC')
    expect(describeCatalyst({ ...base, kind: 'cron', settings: { frequency: 'fortnightly', timezone: 'UTC' } })).toBe(base.selector)
  })
})
