import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendBookingConfirmationEmail, sendCancellationEmail } from '@/lib/email';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);
  const { guestName, personnummer, guestPhone, guestEmail, status } = await request.json();

  // Fetch current booking before update to detect status change
  const before = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true },
  });

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(guestName !== undefined ? { guestName } : {}),
      ...(personnummer !== undefined ? { personnummer } : {}),
      ...(guestPhone !== undefined ? { guestPhone: guestPhone || null } : {}),
      ...(guestEmail !== undefined ? { guestEmail } : {}),
      ...(status !== undefined ? { status } : {}),
    },
    include: { session: { include: { course: true, school: true } }, user: { select: { name: true, email: true } } },
  });

  // Send cancellation email if status just changed to Canceled
  if (status === 'Canceled' && before?.status !== 'Canceled') {
    const recipientEmail = updated.guestEmail || updated.user?.email || null;
    const recipientName = updated.guestName || updated.user?.name || 'Kund';
    if (recipientEmail && updated.session) {
      const start = new Date(updated.session.startTime);
      const end = new Date(updated.session.endTime);
      await sendCancellationEmail({
        recipientEmail,
        recipientName,
        bookingId,
        courseName: `${updated.session.course.titleSv} (${updated.session.course.behorighet})`,
        courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
        courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
        location: updated.session.course.location || updated.session.school?.name || '',
        cancelledBy: 'admin',
      });
    }
  }

  return NextResponse.json({ booking: updated });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);

  // Fetch full booking before deleting — needed for email and seat restore
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: { include: { course: true, school: true } },
      user: { select: { name: true, email: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });

  // Delete payment if exists, then booking
  await prisma.payment.deleteMany({ where: { bookingId } });
  await prisma.booking.delete({ where: { id: bookingId } });

  // Restore seat
  if (booking.status !== 'Canceled') {
    await prisma.session.update({
      where: { id: booking.sessionId },
      data: { seatsAvailable: { increment: 1 } },
    });
  }

  // Send cancellation email if we have a contact address
  const recipientEmail = booking.guestEmail || booking.user?.email || null;
  const recipientName = booking.guestName || booking.user?.name || 'Kund';
  if (recipientEmail && booking.session) {
    const start = new Date(booking.session.startTime);
    const end = new Date(booking.session.endTime);
    sendCancellationEmail({
      recipientEmail,
      recipientName,
      bookingId,
      courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
      courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
      courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
      location: booking.session.course.location || booking.session.school?.name || '',
      cancelledBy: 'admin',
    }).catch((err) => console.error('[Admin delete] Email failed:', err));
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // Add a student manually to a session (sessionId = params.id here used as sessionId)
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const sessionId = parseInt(params.id);
  const { guestName, personnummer, guestPhone, guestEmail } = await request.json();

  if (!guestName || !personnummer) {
    return NextResponse.json({ error: 'Namn och personnummer krävs' }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { course: true, school: true },
  });
  if (!session) return NextResponse.json({ error: 'Pass hittades inte' }, { status: 404 });
  if (session.seatsAvailable <= 0) return NextResponse.json({ error: 'Inga platser kvar' }, { status: 400 });

  const booking = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.create({
      data: {
        sessionId,
        guestName,
        personnummer,
        guestPhone: guestPhone || null,
        guestEmail: guestEmail || null,
        status: 'Confirmed',
        bookedByRole: 'admin',
      },
    });
    await tx.session.update({
      where: { id: sessionId },
      data: { seatsAvailable: { decrement: 1 } },
    });
    return b;
  });

  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  const courseDate = start.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const courseTime = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
  const location = session.course.location || session.school.name;

  // Send confirmation email if email provided
  if (guestEmail) {
    await sendBookingConfirmationEmail({
      recipientEmail: guestEmail,
      recipientName: guestName,
      bookingId: booking.id,
      courseName: `${session.course.titleSv} (${session.course.behorighet})`,
      courseDate,
      courseTime,
      location,
      personnummer,
      phone: guestPhone || null,
      customMessage: session.receiptMessage || session.course.receiptMessage || '',
    });
  }

  // Send WhatsApp confirmation if phone provided
  if (guestPhone) {
    const wahaUrl = process.env.WAHA_URL;
    const wahaSession = process.env.WAHA_SESSION ?? 'default';
    if (wahaUrl) {
      const dateStrSv = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
      const msg =
        `✅ *Bokning bekräftad!*\n` +
        `Du har blivit inbokad på en kurs hos Uppsala Halkbana.\n\n` +
        `📚 ${session.course.titleSv}\n` +
        `📅 ${dateStrSv}\n` +
        `🕐 ${courseTime}\n` +
        `📍 ${location}\n` +
        `🎫 Bokning *#${booking.id}*\n\n` +
        `_Vid frågor, ring 07 07 66 66 61_\n\n` +
        `---\n` +
        `✅ *Booking confirmed!*\n` +
        `You have been booked for a course at Uppsala Halkbana.\n\n` +
        `📚 ${session.course.titleEn}\n` +
        `📅 ${dateStrSv}\n` +
        `🕐 ${courseTime}\n` +
        `📍 ${location}\n` +
        `🎫 Booking *#${booking.id}*\n\n` +
        `_Questions? Call 07 07 66 66 61_`;
      await fetch(`${wahaUrl}/api/sendText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.WAHA_API_KEY ?? '' },
        body: JSON.stringify({
          session: wahaSession,
          chatId: `${guestPhone.replace(/\D/g, '')}@c.us`,
          text: msg,
        }),
      }).catch((err) => console.error('[Admin booking] WhatsApp confirm failed:', err));
    }
  }

  return NextResponse.json({ booking }, { status: 201 });
}
