import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaymentRequest } from '@/lib/swish';
import { sendReceiptEmail, sendPaymentFailedEmail } from '@/lib/email';

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
        courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
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

    // Send WhatsApp confirmation if booked via WhatsApp and has phone
    const waPhone = booking.bookedByRole === 'whatsapp' ? booking.guestPhone : null;
    if (waPhone) {
      const wahaUrl = process.env.WAHA_URL;
      const wahaSession = process.env.WAHA_SESSION ?? 'default';
      if (wahaUrl) {
        const start = new Date(booking.session.startTime);
        const dateStrSv = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        const location = booking.session.course?.location || booking.session.school?.name || '';
        const msg =
          `✅ *Betalning bekräftad!*\n` +
          `Bokning *#${bookingId}* är nu bekräftad.\n\n` +
          `📚 ${booking.session.course.titleSv}\n` +
          `📅 ${dateStrSv}\n` +
          `🕐 ${timeStr}\n` +
          `📍 ${location}\n\n` +
          `_Vi ses där! Om du har frågor, ring 07 07 66 66 61_\n\n` +
          `---\n` +
          `✅ *Payment confirmed!*\n` +
          `Booking *#${bookingId}* is now confirmed.\n\n` +
          `📚 ${booking.session.course.titleEn}\n` +
          `📅 ${dateStrSv}\n` +
          `🕐 ${timeStr}\n` +
          `📍 ${location}\n\n` +
          `_See you there! Questions? Call 07 07 66 66 61_`;
        await fetch(`${wahaUrl}/api/sendText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.WAHA_API_KEY ?? '' },
          body: JSON.stringify({
            session: wahaSession,
            chatId: `${waPhone.replace(/\D/g, '')}@c.us`,
            text: msg,
          }),
        }).catch((err) => console.error('[Swish] WhatsApp confirm failed:', err));
      }
    }
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
        courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
      });
    }
  }

  // Always respond 200 to Swish
  return new Response('OK', { status: 200 });
}
