export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'instructor') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const sessions = await prisma.session.findMany({
    where: {
      startTime: { gte: todayStart, lte: todayEnd },
      assignedSchoolUsers: { some: { id: authUser.userId } },
    },
    include: {
      course: { select: { titleSv: true, type: true, behorighet: true } },
      bookings: {
        where: { status: { not: 'Canceled' } },
        select: { id: true, result: true },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json({ sessions });
}
