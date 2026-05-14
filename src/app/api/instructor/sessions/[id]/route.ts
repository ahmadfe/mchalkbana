export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'instructor') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const sessionId = parseInt(params.id);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      course: { select: { titleSv: true, type: true, behorighet: true, location: true } },
      assignedSchoolUsers: { select: { id: true } },
      bookings: {
        where: { status: { not: 'Canceled' } },
        select: {
          id: true,
          guestName: true,
          personnummer: true,
          guestPhone: true,
          guestEmail: true,
          result: true,
          resultNote: true,
          bookedByRole: true,
          user: { select: { name: true, phone: true, email: true } },
        },
        orderBy: { bookingTime: 'asc' },
      },
    },
  });

  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });

  const isAssigned = session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  if (!isAssigned) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  return NextResponse.json({ session });
}
