import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendReceiptEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: { include: { course: true, school: true } },
      user: { select: { name: true, email: true } },
      payment: { select: { transactionId: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });

  const recipientEmail = booking.guestEmail ?? booking.user?.email ?? null;
  if (!recipientEmail) return NextResponse.json({ error: 'Ingen e-postadress på bokningen' }, { status: 400 });

  const recipientName = booking.guestName ?? booking.user?.name ?? 'Kund';
  const start = new Date(booking.session.startTime);
  const end = new Date(booking.session.endTime);

  let customMessage = booking.session.receiptMessage || '';
  if (!customMessage) {
    const setting = await prisma.settings.findUnique({ where: { key: 'receipt_message' } });
    customMessage = setting?.value || '';
  }

  await sendReceiptEmail({
    recipientEmail,
    recipientName,
    bookingId,
    transactionId: booking.payment?.transactionId ?? `manual_${Date.now()}`,
    courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
    courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
    courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
    location: booking.session.course.location || booking.session.school?.name || '',
    price: booking.session.course.price,
    startTimeIso: start.toISOString(),
    endTimeIso: end.toISOString(),
    personnummer: booking.personnummer,
    phone: booking.guestPhone,
    customMessage,
  });

  return NextResponse.json({ ok: true });
}
