export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { attachCoupon } from '@/lib/coupons';
import { checkoutOrder } from '@/lib/checkoutKlarna';
import { cancelPendingBooking, createPendingBooking } from '@/lib/publicBooking';
import { getStripe, releaseStaleStripeBookings, stripeConfigured, type StripeMethod } from '@/lib/stripe';

/**
 * Kassan, kort/Apple Pay/Google Pay eller Klarna via Stripe. Anropas när kunden trycker "Betala":
 * skapar den väntande bokningen och en PaymentIntent med serverns pris. Webbläsaren bekräftar sedan betalningen.
 * Body: { sessionId, couponCode?, method: 'card'|'klarna', guestName, personnummer, guestPhone?, guestEmail }
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Kortbetalning är inte aktiverad' }, { status: 503 });
  const authUser = await getAuthUserFromRequest(request);
  const body = await request.json().catch(() => ({}));
  const sessionId = Number(body.sessionId);
  const method: StripeMethod = body.method === 'klarna' ? 'klarna' : 'card';

  await releaseStaleStripeBookings().catch(e => console.error('[Stripe] stale cleanup', e));

  const priced = await checkoutOrder(sessionId, body.couponCode || null);
  if ('error' in priced) return NextResponse.json({ error: priced.error }, { status: priced.status });
  const amount = priced.order.amount;

  const created = await createPendingBooking(sessionId, authUser?.userId ?? null, {
    guestName: body.guestName, personnummer: body.personnummer, guestPhone: body.guestPhone, guestEmail: body.guestEmail,
  });
  if ('error' in created) return NextResponse.json({ error: created.error }, { status: created.status });
  const bookingId = created.booking.id;

  // Rabattkoden låses till bokningen och priset sparas – samma belopp registreras när betalningen är klar
  if (body.couponCode) {
    const coupon = await attachCoupon(bookingId, sessionId, String(body.couponCode));
    if ('error' in coupon || coupon.price !== amount) {
      await cancelPendingBooking(bookingId);
      return NextResponse.json({ error: 'error' in coupon ? coupon.error : 'Priset har ändrats – försök igen' }, { status: 409 });
    }
  } else {
    await prisma.booking.update({ where: { id: bookingId }, data: { price: amount } });
  }

  try {
    const pi = await getStripe().paymentIntents.create({
      amount: amount * 100, // öre
      currency: 'sek',
      allowed_payment_method_types: [method],
      description: `${priced.order.title} ${priced.order.description} – bokning #${bookingId}`,
      metadata: { bookingId: String(bookingId), sessionId: String(sessionId) },
    });
    await prisma.booking.update({ where: { id: bookingId }, data: { stripeIntentId: pi.id } });
    return NextResponse.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id, bookingId, amount });
  } catch (e) {
    console.error('[Stripe] create intent', e);
    await cancelPendingBooking(bookingId);
    return NextResponse.json({ error: 'Betalningen kunde inte startas – försök igen eller välj Swish' }, { status: 502 });
  }
}
