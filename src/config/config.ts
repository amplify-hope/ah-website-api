import dotenv from 'dotenv'
dotenv.config()

export default {
  db: {
    user: process.env.DBUSER,
    password: process.env.DBPASSWORD,
    host: process.env.DBHOST,
    port: Number(process.env.DBPORT),
    database: process.env.DBDATABASE
  },
  port: Number(process.env.PORT) || 3002,
  environment: process.env.NODE_ENV || 'development',
  sentryDsn: process.env.SENTRY_DSN,
  apiBaseUrl: process.env.API_BASE_URL,
  clientBaseUrl: process.env.CLIENT_BASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webHookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    // Only set while migrating webhook endpoints to a new Stripe API version
    webhookSecretNext: process.env.STRIPE_WEBHOOK_SECRET_NEXT || undefined,
    webhookActiveVersion: process.env.STRIPE_WEBHOOK_ACTIVE_VERSION || undefined,
    recurringProductId: process.env.STRIPE_RECURRING_PRODUCT_ID
  },
  resend: {
    email: 'no-reply@amplifyhope.cc',
    templateId: process.env.RESEND_TEMPLATE_ID,
    apiKey: process.env.RESEND_API_KEY
  }
}
