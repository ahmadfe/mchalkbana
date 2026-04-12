import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createPaymentRequest } from '@/lib/swish';

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

export async function POST(request: Request) {
  const { bookingId, payerPhone } = await request.json();

  if (!bookingId || !payerPhone) {
    return NextResponse.json({ error: 'bookingId och telefonnummer krävs' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true } } },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.status === 'Paid') return NextResponse.json({ error: 'Bokning redan betald' }, { status: 400 });

  try {
    const { swishRequestId } = await createPaymentRequest({
      bookingId: booking.id,
      amount: booking.session.course.price,
      payerPhone,
      message: `Uppsala Halkbana – ${booking.session.course.titleSv}`,
    });

    return NextResponse.json({ swishRequestId });
  } catch (err) {
    console.error('[Swish] create-payment error:', err);

    // Cancel the pending booking and restore the seat so it's not permanently consumed
    if (booking.status === 'Pending') {
      try {
        await prisma.$transaction([
          prisma.booking.update({ where: { id: booking.id }, data: { status: 'Canceled' } }),
          prisma.session.update({ where: { id: booking.sessionId }, data: { seatsAvailable: { increment: 1 } } }),
        ]);
      } catch (rollbackErr) {
        console.error('[Swish] Rollback failed for booking', booking.id, rollbackErr);
      }
    }

    return NextResponse.json(
      { error: swishFriendlyError(err) },
      { status: 500 },
    );
  }
}
