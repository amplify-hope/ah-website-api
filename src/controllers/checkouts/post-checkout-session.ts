import { Request, Response } from 'express'
import Stripe from 'stripe'
import { CURRENCY, MAX_AMOUNT, MIN_AMOUNT } from '../../config'
import config from '../../config/config'
import { DonationRequestBody, IntervalOptions } from '../../types'
import { formatAmountForStripe } from '../../utils/stripe-helpers'

export const postCheckoutSession = async (
  req: Request<object, object, DonationRequestBody>,
  res: Response
) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const stripe = new Stripe(config.stripe.secretKey, { typescript: true })

  let intervalCount = 1
  let price: Stripe.Price

  const { amount, email, interval, stripeProductId, notes, isRecurring } =
    req.body

  if (isRecurring && !interval) return res.sendStatus(403)

  if (interval && interval === IntervalOptions.quarter) intervalCount = 3

  const formattedAmount = formatAmountForStripe(amount, CURRENCY)
  const stripeInterval: Stripe.PriceListParams.Recurring.Interval =
    interval === IntervalOptions.year ? 'year' : 'month'
  const lookUpKey = `${stripeProductId}|${interval ? interval + '|' : ''}${formattedAmount.toString()}`

  try {
    if (!(amount >= MIN_AMOUNT && amount <= MAX_AMOUNT)) {
      throw new Error('Invalid amount')
    }

    const priceParams: Stripe.PriceListParams = {
      product: stripeProductId,
      lookup_keys: [lookUpKey],
      ...(isRecurring && { recurring: { interval: stripeInterval } })
    }

    const foundPrice = await stripe.prices.list(priceParams)
    price = foundPrice.data[0]

    if (!price) {
      const priceCreateParams: Stripe.PriceCreateParams = {
        currency: CURRENCY,
        product: stripeProductId,
        unit_amount: formattedAmount,
        lookup_key: lookUpKey,
        ...(isRecurring && {
          recurring: {
            interval: stripeInterval!,
            interval_count: intervalCount
          }
        })
      }

      price = await stripe.prices.create(priceCreateParams)
    }

    const customer = await stripe.customers.list({ email })
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customer.data[0] ? customer.data[0].id : undefined,
      customer_email: !customer.data[0] ? email : undefined,
      mode: isRecurring ? 'subscription' : 'payment',
      line_items: [{ price: price.id, quantity: 1 }],
      billing_address_collection: 'required',
      metadata: { notes: notes ?? '' },
      success_url: `${
        req.headers.origin ?? 'http://localhost:3000'
      }/result/{CHECKOUT_SESSION_ID}`,
      cancel_url: req.headers.origin ?? 'http://localhost:3000'
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams)

    res.status(200).json(checkoutSession)
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Internal server error'
    res.status(500).json({ statusCode: 500, message: errorMessage })
  }
}
