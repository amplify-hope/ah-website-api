import { Request, Response } from 'express'
import Stripe from 'stripe'
import config from '../../config/config'

export const getCheckoutSessionById = async (
  req: Request<{ id: string }>,
  res: Response
) => {
  const stripe = new Stripe(config.stripe.secretKey, { typescript: true })

  const { id } = req.params

  try {
    if (!id.startsWith('cs_')) {
      throw Error('Incorrect CheckoutSession Id.')
    }
    const session: Stripe.Checkout.Session =
      await stripe.checkout.sessions.retrieve(id, {
        expand: ['payment_intent']
      })
    res.status(200).json(session)
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Internal Server Error'
    res.status(500).json({ statusCode: 500, message: errorMessage })
  }
}
