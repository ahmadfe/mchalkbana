export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireInstructor } from '@/lib/auth';
import { stockholmDay } from '@/lib/kurser';

/** Lärarens kurser i dag (svensk tid) med hur många som är incheckade och bedömda. */
export async function GET(request: Request) {
  const authUser = await requireInstructor(request);
  if (!authUser) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const { from, to } = stockholmDay(new Date());
  const sessions = await prisma.session.findMany({
    where: {
      startTime: { gte: from, lt: to },
      status: { not: 'canceled' },
      assignedSchoolUsers: { some: { id: authUser.userId } },
    },
    select: {
      id: true, startTime: true, endTime: true, resultsSentAt: true,
      course: { select: { titleSv: true, type: true, behorighet: true } },
      bookings: { where: { status: { not: 'Canceled' } }, select: { checkedInAt: true, result: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json({
    sessions: sessions.map(s => ({
      id: s.id,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      resultsSentAt: s.resultsSentAt?.toISOString() ?? null,
      title: s.course.titleSv,
      type: s.course.type,
      behorighet: s.course.behorighet,
      students: s.bookings.length,
      checkedIn: s.bookings.filter(b => b.checkedInAt).length,
      assessed: s.bookings.filter(b => b.result === 'passed' || b.result === 'failed').length,
    })),
  });
}
