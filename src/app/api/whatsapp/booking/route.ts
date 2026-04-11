import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';
import { sendBookingConfirmationEmail } from '@/lib/email';

// POST — create a booking from WhatsApp
// Body: { sessionId, guestName, personnummer, guestPhone, guestEmail?, role: "admin"|"guest" }
export async function POST(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, guestName, personnummer, guestPhone, guestEmail, role } = await request.json();

  if (!sessionId || !guestName || !personnummer) {
    return NextResponse.json({ error: 'sessionId, guestName and personnummer required' }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { course: true, school: true },
  });
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.seatsAvailable <= 0) return NextResponse.json({ error: 'No seats available' }, { status: 409 });

  // Duplicate check
  const existing = await prisma.booking.findFirst({
    where: { sessionId, personnummer, status: { not: 'Canceled' } },
  });
  if (existing) return NextResponse.json({ error: 'This personnummer is already booked on this session' }, { status: 409 });

  // Admin bookings are Confirmed immediately, guest bookings are Pending until paid
  const status = role === 'admin' ? 'Confirmed' : 'Pending';

  const booking = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.create({
      data: {
        sessionId,
        guestName,
        personnummer,
        guestPhone: guestPhone || null,
        guestEmail: guestEmail || null,
        status,
        bookedByRole: 'whatsapp',
      },
    });
    await tx.session.update({
      where: { id: sessionId },
      data: { seatsAvailable: { decrement: 1 } },
    });
    return b;
  });

  // Admin bookings: send email confirmation if email provided
  if (role === 'admin' && guestEmail) {
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    await sendBookingConfirmationEmail({
      recipientEmail: guestEmail,
      recipientName: guestName,
      bookingId: booking.id,
      courseName: `${session.course.titleSv} (${session.course.behorighet})`,
      courseDate: start.toLocaleDateString('sv-SE'),
      courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
      location: session.course.location || session.school.name,
      personnummer,
      phone: guestPhone || null,
    });
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      status,
      guestName,
      personnummer,
      sessionId,
      courseName: session.course.titleSv,
      courseDate: new Date(session.startTime).toLocaleDateString('sv-SE'),
      price: session.course.price,
    },
  }, { status: 201 });
}
