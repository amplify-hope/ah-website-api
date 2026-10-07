import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import 'dotenv/config'

// v11 collects request bodies, cookies, user info and DB query data unless told
// otherwise. This API handles donor emails, so keep the v10 restrictive baseline.
const sensitiveHeaders = ['forwarded', '-ip', 'remote-', 'via', '-user']

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    nodeProfilingIntegration()
  ],
  tracesSampleRate: 0.1,
  profileSessionSampleRate: 0.1,
  profileLifecycle: 'trace',
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { deny: sensitiveHeaders },
      response: { deny: sensitiveHeaders }
    },
    httpBodies: [],
    urlQueryParams: { deny: sensitiveHeaders },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false }
  }
})
