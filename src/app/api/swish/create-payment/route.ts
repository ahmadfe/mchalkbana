import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createPaymentRequest } from '@/lib/swish';
import { attachCoupon } from '@/lib/coupons';
import { completePaidBooking } from '@/lib/payments';

const SWISH_ERROR_MESSAGES: Record<string, string> = {
  ACMT03: 'Mobilnumret är inte anslutet till Swish. Kontrollera att du angett rätt nummer och att Swish är aktiverat.',
  ACMT07: 'Swish-kontot är inte aktivt. Kontakta din bank.',
  BE18:   'Ogiltigt mobilnummer. Kontrollera att du angett rätt format (t.ex. 070-123 45 67).',
  RF07:   'Betalningen avvisades av Swish. Försök igen.',
  FF10:   'Betalningen avvisades av din bank. Kontakta din bank för mer information.',
  TM01:   'Tidsgräns nådd – du godkände inte betalningen i tid. Försök igen.',
  BANKIDCL: 'BankID-verifiering avbröts. Försök igen.',
};

function swishFriendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  try {
    const match = msg.match(/\[(\[.+\])\]$/) ?? msg.match(/(\[.+\])$/);
    if (match) {
      const codes = JSON.parse(match[1]) as Array<{ errorCode?: string }>;
      const code = codes[0]?.errorCode;
      if (code && SWISH_ERROR_MESSAGES[code]) return SWISH_ERROR_MESSAGES[code];
    }
  } catch {
    // fall through to generic message
  }
  return 'Swish-betalning misslyckades. Försök igen eller kontakta oss på 07 07 66 66 61.';
}

export const runtime = 'nodejs';

/** Avbryt en väntande bokning och lämna tillbaka platsen */
async function cancelPending(booking: { id: number; status: string; sessionId: number }) {
  if (booking.status !== 'Pending') return;
  try {
    await prisma.$transaction([
      prisma.booking.update({ where: { id: booking.id }, data: { status: 'Canceled' } }),
      prisma.session.update({ where: { id: booking.sessionId }, data: { seatsAvailable: { increment: 1 } } }),
    ]);
  } catch (rollbackErr) {
    console.error('[Swish] Rollback failed for booking', booking.id, rollbackErr);
  }
}

/** { bookingId, payerPhone, couponCode? }. Priset räknas alltid ut här, aldrig i webbläsaren. */
export async function POST(request: Request) {
  const { bookingId, payerPhone, couponCode } = await request.json();

  if (!bookingId) return NextResponse.json({ error: 'bookingId krävs' }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true } } },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.status === 'Paid') return NextResponse.json({ error: 'Bokning redan betald' }, { status: 400 });
  if (booking.status !== 'Pending') return NextResponse.json({ error: 'Bokningen kan inte betalas' }, { status: 400 });

  let amount = booking.session.discountPrice ?? booking.session.course.price;
  if (couponCode) {
    const coupon = await attachCoupon(booking.id, booking.sessionId, String(couponCode));
    if ('error' in coupon) {
      await cancelPending(booking);
      return NextResponse.json({ error: coupon.error }, { status: 400 });
    }
    amount = coupon.price;
  } else {
    await prisma.booking.update({ where: { id: booking.id }, data: { price: amount, couponId: null, couponDiscount: null } });
  }

  // 100 %-rabatt: inget att betala, bokningen bekräftas direkt
  if (amount === 0) {
    await completePaidBooking(booking.id, { provider: 'Rabattkod', transactionId: `kod_${booking.id}` });
    return NextResponse.json({ free: true, amount });
  }

  if (!payerPhone) {
    await cancelPending(booking);
    return NextResponse.json({ error: 'Swish-nummer krävs' }, { status: 400 });
  }

  try {
    const { swishRequestId } = await createPaymentRequest({
      bookingId: booking.id,
      amount,
      payerPhone,
      message: `Uppsala Halkbana – ${booking.session.course.titleSv}`,
    });

    return NextResponse.json({ swishRequestId, amount });
  } catch (err) {
    console.error('[Swish] create-payment error:', err);
    // Avbryt den väntande bokningen så att platsen inte blir upptagen för alltid
    await cancelPending(booking);
    return NextResponse.json({ error: swishFriendlyError(err) }, { status: 500 });
  }
}
