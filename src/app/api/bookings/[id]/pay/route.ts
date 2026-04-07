import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendReceiptEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const bookingId = parseInt(params.id);
  const { provider } = await request.json();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: { include: { course: true, school: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.status === 'Paid') return NextResponse.json({ error: 'Bokning redan betald' }, { status: 400 });

  // For user bookings (not guest), verify ownership
  if (booking.userId) {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser || authUser.userId !== booking.userId) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
    }
  }

  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: 'Paid' } }),
    prisma.payment.create({
      data: {
        bookingId,
        amount: booking.session.course.price,
        provider: provider || 'Stripe',
        status: 'Succeeded',
        transactionId,
      },
    }),
  ]);

  // Resolve recipient — prefer guest fields, fall back to logged-in user
  const recipientEmail = booking.guestEmail || booking.user?.email || null;
  const recipientName = booking.guestName || booking.user?.name || 'Kund';

  if (recipientEmail) {
    const setting = await prisma.settings.findUnique({ where: { key: 'receipt_message' } });
    const customMessage = setting?.value || '';

    const start = new Date(booking.session.startTime);
    const end = new Date(booking.session.endTime);

    await sendReceiptEmail({
      recipientEmail,
      recipientName,
      bookingId,
      transactionId,
      courseName: booking.session.course.titleSv,
      courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
      location: booking.session.school?.name || '',
      price: booking.session.course.price,
      startTimeIso: booking.session.startTime,
      endTimeIso: booking.session.endTime,
      personnummer: booking.personnummer,
      phone: booking.guestPhone,
      customMessage,
    });
  } else {
    console.warn('[Pay] No email address found for booking #' + bookingId + ' — skipping invoice email');
  }

  return NextResponse.json({ bookingId, transactionId });
}
