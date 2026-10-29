import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaymentRequest } from '@/lib/swish';
import { sendPaymentFailedEmail, sendInternalBookingNotification } from '@/lib/email';
import { completePaidBooking } from '@/lib/payments';

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
    await completePaidBooking(bookingId, { provider: 'Swish', transactionId: body.paymentReference ?? `swish_${Date.now()}` });
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

    // Internal staff notification for payment failure / cancellation
    {
      const start = new Date(booking.session.startTime);
      const end = new Date(booking.session.endTime);
      sendInternalBookingNotification({
        bookingId,
        studentName: booking.guestName ?? booking.user?.name ?? 'Okänd',
        personnummer: booking.personnummer ?? '–',
        phone: booking.guestPhone,
        email: booking.guestEmail ?? booking.user?.email,
        courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
        courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
        courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
        location: booking.session.meetingPlace || booking.session.course.location || booking.session.school?.name || '',
        bookedBy: (booking.bookedByRole as 'guest' | 'user' | 'admin' | 'school') ?? 'guest',
        status: 'Canceled',
        cancelledBy: 'user',
      }).catch((err) => console.error('[Swish] Internal cancel notification failed:', err));
    }

    // Send payment failed email
    const failedEmail = booking.guestEmail ?? booking.user?.email ?? null;
    const failedName = booking.guestName ?? booking.user?.name ?? 'Kund';
    if (failedEmail) {
      const start = new Date(booking.session.startTime);
      const end = new Date(booking.session.endTime);
      await sendPaymentFailedEmail({
        recipientEmail: failedEmail,
        recipientName: failedName,
        bookingId,
        courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
        courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
        courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
      });
    }
  }

  // Always respond 200 to Swish
  return new Response('OK', { status: 200 });
}
