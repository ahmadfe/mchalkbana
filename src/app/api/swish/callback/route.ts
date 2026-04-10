import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaymentRequest } from '@/lib/swish';
import { sendReceiptEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: {
    payeePaymentReference?: string;
    paymentReference?: string;
    status?: string;
    id?: string;
  };

  try {
    body = await request.json();
  } catch {
    return new Response('OK', { status: 200 });
  }

  const { payeePaymentReference, status, id: swishRequestId } = body;

  console.log('[Swish] Callback received:', { payeePaymentReference, status, swishRequestId });

  if (!payeePaymentReference) return new Response('OK', { status: 200 });

  const bookingId = parseInt(payeePaymentReference);
  if (isNaN(bookingId)) return new Response('OK', { status: 200 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: { include: { course: true, school: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!booking) {
    console.warn('[Swish] Callback for unknown booking:', bookingId);
    return new Response('OK', { status: 200 });
  }

  // Verify with Swish API (don't trust callback payload alone)
  let verifiedStatus = status;
  if (swishRequestId) {
    try {
      const verified = await getPaymentRequest(swishRequestId);
      verifiedStatus = verified.status;
    } catch (err) {
      console.error('[Swish] Verification failed, using callback status:', err);
    }
  }

  if (verifiedStatus === 'PAID') {
    if (booking.status === 'Paid') return new Response('OK', { status: 200 }); // idempotent

    const transactionId = body.paymentReference ?? `swish_${Date.now()}`;

    await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: 'Paid' } }),
      prisma.payment.create({
        data: {
          bookingId,
          amount: booking.session.course.price,
          provider: 'Swish',
          status: 'Succeeded',
          transactionId,
        },
      }),
    ]);

    // Send receipt email
    const recipientEmail = booking.guestEmail ?? booking.user?.email ?? null;
    const recipientName = booking.guestName ?? booking.user?.name ?? 'Kund';

    if (recipientEmail) {
      const start = new Date(booking.session.startTime);
      const end = new Date(booking.session.endTime);

      await sendReceiptEmail({
        recipientEmail,
        recipientName,
        bookingId,
        transactionId,
        courseName: booking.session.course.titleSv,
        courseDate: start.toLocaleDateString('sv-SE', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        }),
        courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
        location: booking.session.school?.name ?? '',
        price: booking.session.course.price,
        startTimeIso: new Date(booking.session.startTime).toISOString(),
        endTimeIso: new Date(booking.session.endTime).toISOString(),
        personnummer: booking.personnummer,
        phone: booking.guestPhone,
        customMessage: booking.session.course.receiptMessage ?? '',
      });
    }

    console.log('[Swish] Booking #' + bookingId + ' marked as Paid');
  } else if (
    verifiedStatus === 'DECLINED' ||
    verifiedStatus === 'ERROR' ||
    verifiedStatus === 'TIMEOUT'
  ) {
    if (booking.status !== 'Pending') return new Response('OK', { status: 200 });

    // Cancel booking and restore seat
    await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: 'Canceled' } }),
      prisma.session.update({
        where: { id: booking.sessionId },
        data: { seatsAvailable: { increment: 1 } },
      }),
    ]);

    console.log('[Swish] Booking #' + bookingId + ' canceled — Swish status:', verifiedStatus);
  }

  // Always respond 200 to Swish
  return new Response('OK', { status: 200 });
}
