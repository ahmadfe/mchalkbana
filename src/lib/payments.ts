import { prisma } from '@/lib/db';
import { sendReceiptEmail, sendInternalBookingNotification } from '@/lib/email';
import { formatCode } from '@/lib/coupons';

/** Det eleven ska betala: priset som sattes när betalningen startade, annars rea eller ordinarie pris. */
export function amountToPay(booking: { price: number | null }, session: { discountPrice: number | null; course: { price: number } }) {
  return booking.price ?? session.discountPrice ?? session.course.price;
}

/**
 * Markerar bokningen som betald, sparar betalningen och skickar kvitto, intern avisering och
 * ev. WhatsApp-bekräftelse. Används av Swish-callbacken och av 100 %-rabattkoder.
 */
export async function completePaidBooking(bookingId: number, { provider, transactionId }: { provider: string; transactionId: string }) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: { include: { course: true, school: true } },
      user: { select: { name: true, email: true } },
      coupon: { select: { code: true } },
    },
  });
  if (!booking || booking.status === 'Paid') return; // idempotent

  const amount = amountToPay(booking, booking.session);
  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: 'Paid' } }),
    prisma.payment.create({ data: { bookingId, amount, provider, status: 'Succeeded', transactionId } }),
  ]);

  const start = new Date(booking.session.startTime);
  const end = new Date(booking.session.endTime);
  const courseName = `${booking.session.course.titleSv} (${booking.session.course.behorighet})`;
  const courseDate = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' });
  const courseTime = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
  const location = booking.session.meetingPlace || booking.session.course.location || booking.session.school?.name || '';

  const recipientEmail = booking.guestEmail ?? booking.user?.email ?? null;
  if (recipientEmail) {
    await sendReceiptEmail({
      recipientEmail,
      recipientName: booking.guestName ?? booking.user?.name ?? 'Kund',
      bookingId,
      transactionId,
      courseName,
      courseDate,
      courseTime,
      location,
      price: amount,
      startTimeIso: start.toISOString(),
      endTimeIso: end.toISOString(),
      personnummer: booking.personnummer,
      phone: booking.guestPhone,
      customMessage: booking.session.receiptMessage || booking.session.course.receiptMessage || '',
      coupon: booking.coupon && booking.couponDiscount ? { code: formatCode(booking.coupon.code), discount: booking.couponDiscount } : null,
    });
  }

  sendInternalBookingNotification({
    bookingId,
    studentName: booking.guestName ?? booking.user?.name ?? 'Okänd',
    personnummer: booking.personnummer ?? '–',
    phone: booking.guestPhone,
    email: booking.guestEmail ?? booking.user?.email,
    courseName,
    courseDate,
    courseTime,
    location,
    bookedBy: (booking.bookedByRole as 'guest' | 'user' | 'admin' | 'school') ?? 'guest',
    status: 'Paid',
  }).catch((err) => console.error('[Payment] Internal notification failed:', err));

  console.log('[Payment] Booking #' + bookingId + ' marked as Paid via ' + provider);

  // WhatsApp-bekräftelse om eleven bokade via WhatsApp
  const waPhone = booking.bookedByRole === 'whatsapp' ? booking.guestPhone : null;
  const wahaUrl = process.env.WAHA_URL;
  if (waPhone && wahaUrl) {
    const dateStrSv = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });
    const timeStr = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
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
      body: JSON.stringify({ session: process.env.WAHA_SESSION ?? 'default', chatId: `${waPhone.replace(/\D/g, '')}@c.us`, text: msg }),
    }).catch((err) => console.error('[Payment] WhatsApp confirm failed:', err));
  }
}
