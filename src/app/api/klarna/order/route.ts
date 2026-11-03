export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { attachCoupon } from '@/lib/coupons';
import { cancelOrder, createOrder, klarnaConfigured, KlarnaError } from '@/lib/klarna';
import { checkoutOrder, splitName } from '@/lib/checkoutKlarna';
import { cancelPendingBooking, createPendingBooking } from '@/lib/publicBooking';
import { completePaidBooking } from '@/lib/payments';

/**
 * Kunden har godkänt i Klarnas widget: skapa bokningen, lägg ordern hos Klarna (beloppet reserveras)
 * och bekräfta bokningen. Beloppet dras när kursen är genomförd.
 * Body: { sessionId, couponCode?, authorizationToken, guestName, personnummer, guestPhone?, guestEmail }
 */
export async function POST(request: Request) {
  if (!klarnaConfigured()) return NextResponse.json({ error: 'Klarna är inte aktiverat' }, { status: 503 });
  const authUser = await getAuthUserFromRequest(request);
  const body = await request.json().catch(() => ({}));
  const sessionId = Number(body.sessionId);
  if (!body.authorizationToken) return NextResponse.json({ error: 'Klarna-godkännande saknas' }, { status: 400 });

  const priced = await checkoutOrder(sessionId, body.couponCode || null);
  if ('error' in priced) return NextResponse.json({ error: priced.error }, { status: priced.status });

  const created = await createPendingBooking(sessionId, authUser?.userId ?? null, {
    guestName: body.guestName, personnummer: body.personnummer, guestPhone: body.guestPhone, guestEmail: body.guestEmail,
  });
  if ('error' in created) return NextResponse.json({ error: created.error }, { status: created.status });
  const bookingId = created.booking.id;

  // Samma pris som i Klarna-sessionen; rabattkoden låses till bokningen
  if (body.couponCode) {
    const coupon = await attachCoupon(bookingId, sessionId, String(body.couponCode));
    if ('error' in coupon || coupon.price !== priced.order.amount) {
      await cancelPendingBooking(bookingId);
      return NextResponse.json({ error: 'error' in coupon ? coupon.error : 'Priset har ändrats – försök igen' }, { status: 409 });
    }
  } else {
    await prisma.booking.update({ where: { id: bookingId }, data: { price: priced.order.amount } });
  }

  const name = String(body.guestName || authUser?.name || '').trim();
  let orderId: string;
  try {
    const order = await createOrder(String(body.authorizationToken), priced.order, { bookingId, sessionId }, {
      ...splitName(name || 'Kund'),
      email: String(body.guestEmail || authUser?.email || ''),
      phone: body.guestPhone || null,
    });
    if (order.fraud_status === 'REJECTED') {
      await cancelOrder(order.order_id).catch(() => {});
      await cancelPendingBooking(bookingId);
      return NextResponse.json({ error: 'Klarna kunde inte godkänna köpet. Välj Swish eller kontakta Klarna.' }, { status: 402 });
    }
    orderId = order.order_id;
  } catch (e) {
    await cancelPendingBooking(bookingId);
    if (e instanceof KlarnaError) return NextResponse.json({ error: 'Klarna kunde inte slutföra köpet – försök igen eller välj Swish' }, { status: 502 });
    throw e;
  }

  await completePaidBooking(bookingId, { provider: 'Klarna', transactionId: orderId, status: 'Authorized' });
  return NextResponse.json({ bookingId, amount: priced.order.amount });
}
