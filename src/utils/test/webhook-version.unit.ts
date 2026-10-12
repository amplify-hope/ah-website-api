import { expect } from 'chai'
import {
  getWebhookEndpointVersion,
  getWebhookVersionAction
} from '../webhook-version'

describe('#webhookVersion', () => {
  describe('getWebhookEndpointVersion', () => {
    it('should return the version query param when it is a non-empty string', () => {
      expect(getWebhookEndpointVersion('2026-09-30')).to.eq('2026-09-30')
    })

    it('should treat missing, empty and non-string values as no version', () => {
      expect(getWebhookEndpointVersion(undefined)).to.eq(undefined)
      expect(getWebhookEndpointVersion('')).to.eq(undefined)
      expect(getWebhookEndpointVersion(['a', 'b'])).to.eq(undefined)
      expect(getWebhookEndpointVersion({ a: 'b' })).to.eq(undefined)
    })
  })

  describe('getWebhookVersionAction', () => {
    it('should process the original endpoint and ignore the new one before the switch', () => {
      expect(getWebhookVersionAction(undefined, undefined)).to.eq('process')
      expect(getWebhookVersionAction('2026-09-30', undefined)).to.eq('ignore')
    })

    it('should process the new endpoint and retry the original one after the switch', () => {
      expect(getWebhookVersionAction('2026-09-30', '2026-09-30')).to.eq(
        'process'
      )
      expect(getWebhookVersionAction(undefined, '2026-09-30')).to.eq('retry')
    })

    it('should ignore an endpoint for a version that is not active', () => {
      expect(getWebhookVersionAction('2025-02-24', '2026-09-30')).to.eq(
        'ignore'
      )
    })
  })
})
