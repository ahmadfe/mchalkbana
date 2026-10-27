export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { parseKursInput } from '@/lib/kurser';
import { parseReservation, saveReservation, type ReservationInput } from '@/lib/allocations';

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
      bookings: {
        where: { status: { not: 'Canceled' } },
        select: { status: true, bookedBySchoolUserId: true, payment: { select: { id: true } } },
      },
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
      location: s.meetingPlace || s.course.location || s.school.name,
      filialName: s.school.name,
      seatLimit: s.seatLimit,
      booked: s.bookings.length,
      unpaid: s.bookings.filter(b => !b.bookedBySchoolUserId && !b.payment && b.status !== 'Paid').length,
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

  const body = await request.json();
  const parsed = await parseKursInput(body, { partial: false });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, instructorIds } = parsed;

  // Skolreservationer kontrolleras innan kursen skapas, så att inget halvfärdigt sparas
  const reservations: ReservationInput[] = [];
  for (const r of Array.isArray(body.reservations) ? body.reservations : []) {
    const p = parseReservation(r);
    if ('error' in p) return NextResponse.json({ error: p.error }, { status: 400 });
    if (reservations.some(x => x.schoolUserId === p.data.schoolUserId)) {
      return NextResponse.json({ error: 'Samma trafikskola är vald två gånger' }, { status: 400 });
    }
    reservations.push(p.data);
  }
  const reserved = reservations.reduce((s, r) => s + r.seats, 0);
  if (reserved > data.seatLimit!) {
    return NextResponse.json({ error: `${reserved} reserverade platser men kursen har bara ${data.seatLimit}` }, { status: 400 });
  }

  const session = await prisma.session.create({
    data: {
      ...(data as Required<typeof data>),
      seatsAvailable: data.seatLimit!,
      ...(instructorIds?.length ? { assignedSchoolUsers: { connect: instructorIds.map(id => ({ id })) } } : {}),
    },
  });
  for (const r of reservations) {
    const result = await saveReservation(session.id, r, { notify: body.notifySchools !== false });
    if ('error' in result) {
      return NextResponse.json({ id: session.id, warning: `Kursen skapades men reservationen misslyckades: ${result.error}` }, { status: 201 });
    }
  }
  return NextResponse.json({ id: session.id }, { status: 201 });
}
