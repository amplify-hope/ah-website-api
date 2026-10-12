export type WebhookVersionAction = 'process' | 'ignore' | 'retry'

export const getWebhookEndpointVersion = (
  queryVersion: unknown
): string | undefined =>
  typeof queryVersion === 'string' && queryVersion ? queryVersion : undefined

// During a Stripe API version migration two webhook endpoints deliver every
// event. The original endpoint has no ?version= query param; the new one has
// ?version=<api version>. Only the endpoint matching `activeVersion` is
// processed.
//  - process: this endpoint is the active one
//  - ignore:  a not-yet-active new endpoint, ack with 200 so Stripe doesn't retry
//  - retry:   the original endpoint after the switch, 400 so Stripe re-sends
//             the event (to the new endpoint) if we have to roll back
export const getWebhookVersionAction = (
  endpointVersion: string | undefined,
  activeVersion: string | undefined
): WebhookVersionAction => {
  if (endpointVersion === activeVersion) return 'process'
  return endpointVersion ? 'ignore' : 'retry'
}
