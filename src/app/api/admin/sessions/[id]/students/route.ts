import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const sessionId = parseInt(params.id);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      course: true,
      school: true,
      bookings: {
        where: { status: { not: 'Canceled' } },
        include: {
          user: { select: { name: true, email: true, phone: true, role: true } },
        },
        orderBy: { bookingTime: 'asc' },
      },
    },
  });

  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });

  const students = session.bookings.map((b) => ({
    bookingId: b.id,
    status: b.status,
    bookingTime: b.bookingTime,
    name: b.guestName || b.user?.name || '–',
    personnummer: b.personnummer || '–',
    phone: b.guestPhone || b.user?.phone || '–',
    email: b.guestEmail || b.user?.email || '–',
    bookedByRole: b.bookedByRole,
    bookedBySchool: b.bookedByRole === 'school' ? (b.user?.name || 'Skola') : null,
  }));

  return NextResponse.json({
    session: {
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      seatLimit: session.seatLimit,
      seatsAvailable: session.seatsAvailable,
      course: session.course,
      school: session.school,
    },
    students,
  });
}
