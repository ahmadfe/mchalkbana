import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { completePaidBooking } from '@/lib/payments';
import { cancelPendingBooking } from '@/lib/publicBooking';

/*
 * Stripe: kort (inkl. Apple Pay / Google Pay) och Klarna via Stripe.
 * Pengarna dras vid bokningen. Avbokning senast 48 h före kursstart → full återbetalning (se paymentOnCancel).
 *
 * SÄKERHETSLÅS: på den skarpa webbplatsen (Vercel production) används Stripe bara med live-nycklar (sk_live_… eller begränsad rk_live_…),
 * så att testnycklar aldrig kan ta riktiga kunders bokningar.
 */

export type StripeMethod = 'card' | 'klarna';

/** provider i Payment-tabellen */
export const STRIPE_PROVIDER: Record<StripeMethod, string> = { card: 'stripe', klarna: 'stripe_klarna' };
export const isStripeProvider = (provider: string) => provider === 'stripe' || provider === 'stripe_klarna';

/** Halvfärdiga betalningar äldre än så här släpps (platsen blir ledig igen) */
const STALE_MINUTES = 45;

export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key) return false;
  // Hemlig nyckel (sk_) eller begränsad nyckel (rk_) – på den skarpa webbplatsen bara live
  if (process.env.VERCEL_ENV === 'production' && !key.startsWith('sk_live_') && !key.startsWith('rk_live_')) return false;
  return true;
}

let client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!stripeConfigured()) throw new Error('Stripe är inte aktiverat');
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/** Hämtar PaymentIntent och kontrollerar att den hör till bokningen */
export async function intentForBooking(paymentIntentId: string, bookingId: number): Promise<Stripe.PaymentIntent | null> {
  const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  return Number(pi.metadata?.bookingId) === bookingId ? pi : null;
}

const WALLET_LABEL: Record<string, string> = { apple_pay: 'Apple Pay', google_pay: 'Google Pay' };

/**
 * Betalningen är klar hos Stripe → bokningen blir betald (kvitto skickas). Anropas från både
 * returen i kassan och webhooken – därför idempotent. Har bokningen hunnit släppas återbetalas pengarna.
 */
export async function completeStripePayment(pi: Stripe.PaymentIntent): Promise<'paid' | 'refunded' | 'ignored'> {
  const bookingId = Number(pi.metadata?.bookingId);
  if (!bookingId || pi.status !== 'succeeded') return 'ignored';
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, payment: { select: { id: true } } } });
  if (!booking) return 'ignored';
  if (booking.payment) return 'paid'; // redan registrerad

  if (booking.status === 'Canceled') {
    // Platsen hann släppas (t.ex. över 45 min) – ta inte betalt för en plats eleven inte har
    await getStripe().refunds.create({ payment_intent: pi.id }).catch(e => console.error('[Stripe] Återbetalning misslyckades', pi.id, e));
    console.warn('[Stripe] Betalning för avbokad bokning återbetalad', bookingId, pi.id);
    return 'refunded';
  }

  const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  const type = charge?.payment_method_details?.type ?? pi.payment_method_types?.[0] ?? 'card';
  const method: StripeMethod = type === 'klarna' ? 'klarna' : 'card';
  await completePaidBooking(bookingId, { provider: STRIPE_PROVIDER[method], transactionId: pi.id });

  // Apple Pay / Google Pay syns som anteckning på betalningen
  const wallet = charge?.payment_method_details?.card?.wallet?.type;
  if (wallet && WALLET_LABEL[wallet]) {
    await prisma.payment.update({ where: { bookingId }, data: { note: WALLET_LABEL[wallet] } }).catch(() => {});
  }
  await prisma.booking.update({ where: { id: bookingId }, data: { stripeIntentId: null } }).catch(() => {});
  return 'paid';
}

/** Kunden avbröt / kortet nekades: avbryt betalningen hos Stripe och släpp platsen */
export async function abandonStripeBooking(bookingId: number, paymentIntentId: string | null) {
  if (paymentIntentId) {
    try {
      const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
      if (pi.status === 'succeeded') return completeStripePayment(await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] }));
      if (pi.status !== 'canceled' && pi.status !== 'processing') await getStripe().paymentIntents.cancel(paymentIntentId);
    } catch (e) {
      console.error('[Stripe] Kunde inte avbryta', paymentIntentId, e);
    }
  }
  await cancelPendingBooking(bookingId);
  return 'ignored' as const;
}

/** Släpper halvfärdiga Stripe-bokningar (kunden stängde sidan). Körs när nya betalningar startar. */
export async function releaseStaleStripeBookings() {
  if (!stripeConfigured()) return;
  const stale = await prisma.booking.findMany({
    where: { status: 'Pending', stripeIntentId: { not: null }, bookingTime: { lt: new Date(Date.now() - STALE_MINUTES * 60_000) } },
    select: { id: true, stripeIntentId: true },
    take: 20,
  });
  for (const b of stale) await abandonStripeBooking(b.id, b.stripeIntentId).catch(e => console.error('[Stripe] stale', b.id, e));
}

/** Återbetala hela beloppet */
export async function refundStripe(paymentIntentId: string) {
  return getStripe().refunds.create({ payment_intent: paymentIntentId });
}
