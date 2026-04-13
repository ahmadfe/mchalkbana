import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { createRefund } from '@/lib/swish';
import { sendCancellationEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const paymentId = parseInt(params.id);
  if (isNaN(paymentId)) return NextResponse.json({ error: 'Ogiltigt ID' }, { status: 400 });

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: {
          session: { include: { course: true, school: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!payment) return NextResponse.json({ error: 'Betalning hittades inte' }, { status: 404 });
  if (payment.status === 'Refunded') return NextResponse.json({ error: 'Redan återbetald' }, { status: 400 });

  // transactionId holds the Swish paymentReference from the callback
  if (!payment.transactionId || payment.transactionId.startsWith('swish_')) {
    return NextResponse.json(
      { error: 'Swish betalningsreferens saknas – återbetalning kan inte göras automatiskt' },
      { status: 422 },
    );
  }

  // Call Swish refund API
  await createRefund({
    originalPaymentReference: payment.transactionId,
    amount: payment.amount,
    message: `Aterbetalning bokning #${payment.bookingId}`,
  });

  // Mark payment as refunded and booking as canceled, restore seat
  const [updated] = await prisma.$transaction([
    prisma.payment.update({ where: { id: paymentId }, data: { status: 'Refunded' } }),
    prisma.booking.update({ where: { id: payment.bookingId }, data: { status: 'Canceled' } }),
    prisma.session.update({
      where: { id: payment.booking.sessionId },
      data: { seatsAvailable: { increment: 1 } },
    }),
  ]);

  // Send cancellation + refund confirmation email
  const booking = payment.booking;
  const recipientEmail = booking.guestEmail || booking.user?.email || null;
  const recipientName = booking.guestName || booking.user?.name || 'Kund';
  if (recipientEmail && booking.session) {
    const start = new Date(booking.session.startTime);
    const end = new Date(booking.session.endTime);
    sendCancellationEmail({
      recipientEmail,
      recipientName,
      bookingId: payment.bookingId,
      courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
      courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
      courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
      location: booking.session.course.location || booking.session.school?.name || '',
      cancelledBy: 'admin',
      refundAmount: payment.amount,
    }).catch((err) => console.error('[Refund] Email failed:', err));
  }

  return NextResponse.json({ payment: updated });
}
