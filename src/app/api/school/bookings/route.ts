export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { addSchoolBooking } from '@/lib/schoolBookings';

// GET: all bookings made by this school
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'school') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'Canceled' },
      bookedBySchoolUserId: authUser.userId,
    },
    include: {
      session: { include: { course: true, school: true } },
    },
    orderBy: { bookingTime: 'desc' },
  });

  return NextResponse.json({ bookings });
}

// POST: skolan lägger till en elev på ett pass (reglerna ligger i lib/schoolBookings)
export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'school') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const body = await request.json();
  const result = await addSchoolBooking(authUser.userId, { ...body, sessionId: Number(body.sessionId) }, { by: 'school' });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const booking = await prisma.booking.findUnique({ where: { id: result.bookingId } });
  return NextResponse.json({ booking }, { status: 201 });
}
