import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createPaymentRequest } from '@/lib/swish';

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
      { error: err instanceof Error ? err.message : 'Swish-fel' },
      { status: 500 },
    );
  }
}
