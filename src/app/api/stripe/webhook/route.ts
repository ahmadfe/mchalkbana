export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { abandonStripeBooking, completeStripePayment, getStripe, stripeConfigured } from '@/lib/stripe';

/**
 * Stripe meddelar betalningar här – fungerar även om kunden stänger webbläsaren.
 * Endpoint i Stripe: https://uppsalahalkbana.se/api/stripe/webhook (payment_intent.succeeded, payment_intent.canceled)
 * Hemligheten STRIPE_WEBHOOK_SECRET (whsec_…) kontrollerar att anropet kommer från Stripe.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Stripe inte aktiverat' }, { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret || !signature) return NextResponse.json({ error: 'Signatur saknas' }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (e) {
    console.error('[Stripe] Ogiltig webhook-signatur', e);
    return NextResponse.json({ error: 'Ogiltig signatur' }, { status: 400 });
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      // Hämta igen med laddningen (för Apple Pay / Google Pay-etikett)
      const pi = await getStripe().paymentIntents.retrieve(event.data.object.id, { expand: ['latest_charge'] });
      await completeStripePayment(pi);
    } else if (event.type === 'payment_intent.canceled') {
      const bookingId = Number(event.data.object.metadata?.bookingId);
      if (bookingId) await abandonStripeBooking(bookingId, null);
    }
  } catch (e) {
    console.error('[Stripe] webhook', event.type, e);
    // 500 → Stripe försöker igen senare
    return NextResponse.json({ error: 'Fel vid hantering' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
