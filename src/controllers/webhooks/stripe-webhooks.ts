import Stripe from 'stripe'
import { Request, Response } from 'express'
import config from '../../config/config'
import { upsertProduct } from '../../db'
import { UpsertProductInput } from '../../types'
import { deleteProduct } from '../../db'
import {
  convertUnixToIso,
  getWebhookEndpointVersion,
  getWebhookVersionAction
} from '../../utils'

/* eslint no-console: ["error", { allow: ["log"] }] */
export const stripeWebhooks = async (req: Request, res: Response) => {
  const stripe = new Stripe(config.stripe.secretKey, { typescript: true })

  // A ?version= query param marks the new endpoint created for a Stripe API
  // version migration. Each endpoint has its own signing secret.
  const endpointVersion = getWebhookEndpointVersion(req.query.version)
  const webhookSecret: string | undefined = endpointVersion
    ? config.stripe.webhookSecretNext
    : config.stripe.webHookSecret

  if (req.method === 'POST') {
    if (!webhookSecret) {
      console.log(`⛔ No webhook secret configured for version: ${endpointVersion}`)
      res.status(400).send('Webhook Error: endpoint not configured')
      return
    }

    const sig = req.headers['stripe-signature']!
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown Error'
      if (err! instanceof Error) {
        return console.log(`⛔ Error: ${err}`)
      }
      console.log(`⛔ Error message: ${errorMessage}`)
      res.status(400).send(`Webhook Error: ${errorMessage}`)
      return
    }

    const versionAction = getWebhookVersionAction(
      endpointVersion,
      config.stripe.webhookActiveVersion
    )
    if (versionAction === 'ignore') {
      console.log(`↪️ Ignoring ${event.id} from inactive endpoint ${endpointVersion}`)
      res.status(200).json({ received: true, ignored: true })
      return
    }
    if (versionAction === 'retry') {
      console.log(`↪️ Retry ${event.id} later, original endpoint is no longer active`)
      res.status(400).send('Webhook endpoint is no longer active')
      return
    }

    console.log(`✅ Success: ${event.id}`)

    let charge: Stripe.Charge
    let invoice: Stripe.Invoice
    let paymentIntent: Stripe.PaymentIntent
    let product: Stripe.Product
    let upsertValues: UpsertProductInput

    switch (event.type) {
      case 'invoice.created':
        invoice = event.data.object
        console.log(`🚀 Invoice created because: ${invoice.billing_reason}`)
        if (invoice.billing_reason !== 'subscription_create') {
          await stripe.invoices.finalizeInvoice(invoice.id)
        }
        break
      case 'payment_intent.succeeded':
        paymentIntent = event.data.object
        console.log(`💸 Payment Intent Status: ${paymentIntent.status}`)
        break
      case 'payment_intent.payment_failed':
        paymentIntent = event.data.object
        console.log(
          `⛔ Payment failed: ${paymentIntent.last_payment_error?.message}`
        )
        break
      case 'charge.succeeded':
        charge = event.data.object
        console.log(`💵 Charge succeeded: ${charge.id}`)
        break
      case 'product.created':
      case 'product.updated':
        product = event.data.object
        upsertValues = {
          stripeProductId: product.id,
          name: product.name,
          description: product.description,
          createdAt: convertUnixToIso(product.created),
          updatedAt: convertUnixToIso(product.updated),
          isActive: product.active
        }

        await upsertProduct(upsertValues)
        console.log(
          `🔄 Product: ${product.name}, id: ${product.id} synced to database`
        )
        break
      case 'product.deleted':
        product = event.data.object

        await deleteProduct(product.id)
        console.log(
          `🗑 Product: ${product.name}, id: ${product.id} deleted from database`
        )
        break
      default:
        console.log(`🤷‍♂️ Unhandled event type: ${event.type}`)
        break
    }

    res.status(200).json({ received: true })
  } else {
    res.setHeader('Allow', 'POST')
    res.status(405).end('Method Not Allowed')
  }
}
