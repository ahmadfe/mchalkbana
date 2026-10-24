export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { parseKursInput } from '@/lib/kurser';

/** Midnatt i Stockholm i dag – dagens kurser räknas som kommande hela dagen. */
function startOfTodayStockholm(): Date {
  const now = new Date();
  const [h, m, s] = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(now).split(':').map(Number);
  return new Date(now.getTime() - ((h * 60 + m) * 60 + s) * 1000 - now.getMilliseconds());
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const url = new URL(request.url);
  const past = url.searchParams.get('view') === 'past';
  const filialId = url.searchParams.get('filialId');
  const today = startOfTodayStockholm();

  const sessions = await prisma.session.findMany({
    where: {
      endTime: past ? { lt: today } : { gte: today },
      ...(filialId ? { schoolId: Number(filialId) } : {}),
    },
    include: {
      course: { select: { titleSv: true, type: true, location: true, behorighet: true } },
      school: { select: { name: true } },
      assignedSchoolUsers: { where: { role: 'instructor' }, select: { name: true } },
      _count: { select: { bookings: { where: { status: { not: 'Canceled' } } } } },
    },
    orderBy: { startTime: past ? 'desc' : 'asc' },
    take: past ? 300 : undefined,
  });

  return NextResponse.json({
    kurser: sessions.map(s => ({
      id: s.id,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      title: s.course.titleSv,
      courseType: s.course.type,
      behorighet: s.course.behorighet,
      location: s.course.location || s.school.name,
      filialName: s.school.name,
      seatLimit: s.seatLimit,
      booked: s._count.bookings,
      status: s.status,
      visibility: s.visibility,
      reportToTS: s.reportToTS,
      reportedAt: s.reportedAt?.toISOString() ?? null,
      instructors: s.assignedSchoolUsers.map(u => u.name),
    })),
  });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const parsed = await parseKursInput(await request.json(), { partial: false });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, instructorIds } = parsed;

  const session = await prisma.session.create({
    data: {
      ...(data as Required<typeof data>),
      seatsAvailable: data.seatLimit!,
      ...(instructorIds?.length ? { assignedSchoolUsers: { connect: instructorIds.map(id => ({ id })) } } : {}),
    },
  });
  return NextResponse.json({ id: session.id }, { status: 201 });
}
