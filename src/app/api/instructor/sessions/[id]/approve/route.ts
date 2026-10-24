import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sessionReportFiles } from '@/lib/tsReport';
import { sendResultReportEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'instructor') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const sessionId = parseInt(params.id);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      course: { select: { titleSv: true, type: true, behorighet: true } },
      school: { select: { name: true, bana: true } },
      assignedSchoolUsers: { select: { id: true } },
      bookings: {
        where: { status: { not: 'Canceled' } },
        select: { personnummer: true, guestName: true, attendance: true, user: { select: { name: true } } },
      },
    },
  });

  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });

  const isAssigned = session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  if (!isAssigned) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const datum = session.startTime.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  await sendResultReportEmail({
    subject: `Kursresultat – ${session.course.titleSv} (${datum})`,
    files: sessionReportFiles(session),
    missingBana: session.school.bana ? [] : [session.school.name],
  });
  if (session.status === 'planned') await prisma.session.update({ where: { id: sessionId }, data: { status: 'completed' } });

  return NextResponse.json({ sent: true });
}
