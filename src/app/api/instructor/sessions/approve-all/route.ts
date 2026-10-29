import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireInstructor } from '@/lib/auth';
import { stockholmDay } from '@/lib/kurser';
import { sessionReportFiles } from '@/lib/tsReport';
import { sendResultReportEmail } from '@/lib/email';

export async function POST(request: Request) {
  const authUser = await requireInstructor(request);
  if (!authUser) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const now = new Date();
  // "Idag" i svensk tid – servern går i UTC
  const { from: todayStart, to: todayEnd } = stockholmDay(now);

  const sessions = await prisma.session.findMany({
    where: {
      startTime: { gte: todayStart, lt: todayEnd },
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

  const ids = sessions.map((s) => s.id);
  await prisma.session.updateMany({ where: { id: { in: ids } }, data: { resultsSentAt: now } });
  await prisma.session.updateMany({ where: { id: { in: ids }, status: 'planned' }, data: { status: 'completed' } });

  return NextResponse.json({ sent: true, sessionCount: sessions.length });
}
