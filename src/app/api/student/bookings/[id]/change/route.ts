export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendBookingConfirmationEmail } from '@/lib/email';

const LOCK_HOURS = 74;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const bookingId = parseInt(params.id);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true, school: true } } },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.userId !== authUser.userId) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  if (booking.status === 'Canceled') return NextResponse.json({ error: 'Bokningen är avbokad' }, { status: 400 });

  const hoursUntilSession = (new Date(booking.session.startTime).getTime() - Date.now()) / (1000 * 60 * 60);
  const locked = hoursUntilSession < LOCK_HOURS;

  const cutoff = new Date(Date.now() + 60 * 60 * 1000);
  const alternatives = locked ? [] : await prisma.session.findMany({
    where: {
      courseId: booking.session.courseId,
      id: { not: booking.sessionId },
      seatsAvailable: { gt: 0 },
      startTime: { gt: cutoff },
      visibility: 'public',
    },
    include: { course: true, school: true },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json({
    booking,
    alternatives,
    locked,
    hoursUntilSession: Math.floor(hoursUntilSession),
    lockHours: LOCK_HOURS,
  });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const bookingId = parseInt(params.id);
  const body = await request.json().catch(() => ({}));
  const { newSessionId } = body;

  if (!newSessionId) return NextResponse.json({ error: 'Nytt pass krävs' }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: { include: { course: true, school: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.userId !== authUser.userId) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  if (booking.status === 'Canceled') return NextResponse.json({ error: 'Bokningen är avbokad' }, { status: 400 });

  const hoursUntilSession = (new Date(booking.session.startTime).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilSession < LOCK_HOURS) {
    return NextResponse.json({ error: `Tidsbyte är låst ${LOCK_HOURS} timmar innan kursen` }, { status: 400 });
  }

  if (booking.sessionId === newSessionId) {
    return NextResponse.json({ error: 'Du är redan bokad på detta pass' }, { status: 400 });
  }

  const newSession = await prisma.session.findUnique({
    where: { id: newSessionId },
    include: { course: true, school: true },
  });
  if (!newSession) return NextResponse.json({ error: 'Nytt pass hittades inte' }, { status: 404 });
  if (newSession.courseId !== booking.session.courseId) {
    return NextResponse.json({ error: 'Ogiltigt pass' }, { status: 400 });
  }
  if (newSession.seatsAvailable <= 0) {
    return NextResponse.json({ error: 'Inga platser kvar' }, { status: 400 });
  }

  const oldSessionId = booking.sessionId;
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { sessionId: newSessionId } });
    await tx.session.update({ where: { id: oldSessionId }, data: { seatsAvailable: { increment: 1 } } });
    await tx.session.update({ where: { id: newSessionId }, data: { seatsAvailable: { decrement: 1 } } });
  });

  const recipientEmail = booking.user?.email || null;
  if (recipientEmail) {
    const start = new Date(newSession.startTime);
    const end = new Date(newSession.endTime);
    await sendBookingConfirmationEmail({
      recipientEmail,
      recipientName: booking.user?.name || 'Kund',
      bookingId,
      courseName: `${newSession.course.titleSv} (${newSession.course.behorighet})`,
      courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }),
      courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`,
      location: newSession.course.location || newSession.school?.name || '',
      customMessage: newSession.receiptMessage || newSession.course.receiptMessage || '',
    }).catch((err) => console.error('[student change] Email failed:', err));
  }

  return NextResponse.json({ success: true });
}
