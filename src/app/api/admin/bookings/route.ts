import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookings = await prisma.booking.findMany({
    include: {
      user: { select: { name: true, email: true } },
      session: { include: { course: true, school: true, assignedSchoolUser: { select: { name: true } } } },
      payment: true,
    },
    orderBy: { bookingTime: 'desc' },
  });

  return NextResponse.json({ bookings });
}
