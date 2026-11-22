export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { publicSession } from '@/lib/publicData';
import { requireSchool } from '@/lib/auth';
import { addSchoolBooking } from '@/lib/schoolBookings';

// GET: all bookings made by this school
export async function GET(request: Request) {
  const authUser = await requireSchool(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'Canceled' },
      bookedBySchoolUserId: authUser.userId,
    },
    select: {
      id: true, guestName: true, personnummer: true, guestPhone: true, guestEmail: true, note: true, status: true, bookingTime: true,
      session: { include: { course: true, school: true } },
    },
    orderBy: { bookingTime: 'desc' },
  });

  return NextResponse.json({ bookings: bookings.map(b => ({ ...b, session: publicSession(b.session) })) });
}

// POST: skolan lägger till en elev på ett pass (reglerna ligger i lib/schoolBookings)
export async function POST(request: Request) {
  const authUser = await requireSchool(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const body = await request.json();
  const result = await addSchoolBooking(authUser.userId, { ...body, sessionId: Number(body.sessionId) }, { by: 'school' });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ booking: { id: result.bookingId } }, { status: 201 });
}
