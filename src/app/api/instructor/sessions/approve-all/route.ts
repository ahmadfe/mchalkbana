import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sessionReportFiles } from '@/lib/tsReport';
import { sendResultReportEmail } from '@/lib/email';

export async function POST(request: Request) {
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
      status: { not: 'canceled' },
      assignedSchoolUsers: { some: { id: authUser.userId } },
    },
    include: {
      course: { select: { titleSv: true, type: true, behorighet: true } },
      school: { select: { name: true, bana: true } },
      bookings: {
        where: { status: { not: 'Canceled' } },
        select: { personnummer: true, guestName: true, attendance: true, user: { select: { name: true } } },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  if (sessions.length === 0) return NextResponse.json({ error: 'Inga sessioner idag' }, { status: 400 });

  // En fil per kurs (och del) – Transportstyrelsens format har en <Rapport> per fil
  const datum = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  await sendResultReportEmail({
    subject: `Alla kursresultat ${datum}`,
    files: sessions.flatMap(sessionReportFiles),
    missingBana: Array.from(new Set(sessions.filter((s) => !s.school.bana).map((s) => s.school.name))),
  });

  await prisma.session.updateMany({ where: { id: { in: sessions.map((s) => s.id) }, status: 'planned' }, data: { status: 'completed' } });

  return NextResponse.json({ sent: true, sessionCount: sessions.length });
}
