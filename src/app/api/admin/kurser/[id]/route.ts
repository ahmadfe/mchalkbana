export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { SESSION_STATUSES, expectedPrice, parseKursInput, recalcSeats, setInstructors } from '@/lib/kurser';
import { formatPersonnummer, normalizePersonnummer } from '@/lib/personnummer';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const s = await prisma.session.findUnique({
    where: { id: Number(params.id) },
    include: {
      course: true,
      school: { select: { id: true, name: true, address: true, bana: true } },
      assignedSchoolUsers: { where: { role: 'instructor' }, select: { id: true, name: true } },
      schoolAllocations: { select: { allocatedSeats: true, schoolUser: { select: { name: true } } } },
      comboRisk1Session: { select: { id: true, startTime: true } },
      comboRisk2Session: { select: { id: true, startTime: true } },
      bookings: {
        include: {
          payment: { select: { amount: true, provider: true, status: true, createdAt: true } },
          bookedBySchoolUser: { select: { name: true } },
          checkedInBy: { select: { name: true } },
          user: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { bookingTime: 'asc' },
      },
    },
  });
  if (!s) return NextResponse.json({ error: 'Kursen hittades inte' }, { status: 404 });

  const schoolPrices = new Map(
    (await prisma.schoolCoursePrice.findMany({ where: { courseId: s.courseId } })).map(p => [p.schoolUserId, p.price]),
  );

  const participants = s.bookings.map(b => {
    const pnr = normalizePersonnummer(b.personnummer);
    return {
      bookingId: b.id,
      studentId: b.studentId,
      name: b.guestName || b.user?.name || '–',
      phone: b.guestPhone || b.user?.phone || '',
      email: b.guestEmail || b.user?.email || '',
      personnummer: pnr ? formatPersonnummer(pnr) : (b.personnummer ?? ''),
      status: b.status,
      bookedBy: b.bookedByRole,
      schoolName: b.bookedBySchoolUser?.name ?? null,
      price: expectedPrice(b, s, schoolPrices),
      payment: b.payment ? { ...b.payment, createdAt: b.payment.createdAt.toISOString() } : null,
      paid: !!b.payment || b.status === 'Paid',
      attendance: b.attendance,
      result: b.result,
      checkedInAt: b.checkedInAt?.toISOString() ?? null,
      checkedInBy: b.checkedInBy?.name ?? null,
      idType: b.idType,
    };
  });

  return NextResponse.json({
    kurs: {
      id: s.id,
      courseId: s.courseId,
      title: s.course.titleSv,
      courseType: s.course.type,
      behorighet: s.course.behorighet,
      coursePrice: s.course.price,
      discountPrice: s.discountPrice,
      location: s.course.location || s.school.address,
      filial: s.school,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      seatLimit: s.seatLimit,
      seatsAvailable: s.seatsAvailable,
      status: s.status,
      selfBooking: s.visibility === 'public',
      reportToTS: s.reportToTS,
      reportedAt: s.reportedAt?.toISOString() ?? null,
      internalNotes: s.internalNotes,
      receiptMessage: s.receiptMessage,
      instructors: s.assignedSchoolUsers,
      schoolAllocations: s.schoolAllocations.map(a => ({ name: a.schoolUser.name, seats: a.allocatedSeats })),
      comboRisk1Session: s.comboRisk1Session,
      comboRisk2Session: s.comboRisk2Session,
    },
    participants,
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.id);
  const body = await request.json();

  const parsed = await parseKursInput(body, { partial: true });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, instructorIds } = parsed;

  const extra: { status?: string; reportedAt?: Date | null } = {};
  if (body.status !== undefined) {
    if (!SESSION_STATUSES.includes(body.status)) return NextResponse.json({ error: 'Ogiltig status' }, { status: 400 });
    extra.status = body.status;
  }
  if (body.reported !== undefined) extra.reportedAt = body.reported ? new Date() : null;

  if (data.seatLimit !== undefined) {
    const booked = await prisma.booking.count({ where: { sessionId: id, status: { not: 'Canceled' } } });
    if (data.seatLimit < booked) {
      return NextResponse.json({ error: `Det finns redan ${booked} anmälda – antal platser kan inte vara färre` }, { status: 400 });
    }
  }

  await prisma.session.update({ where: { id }, data: { ...data, ...extra } });
  if (instructorIds) await setInstructors(id, instructorIds);
  if (data.seatLimit !== undefined || data.visibility !== undefined) await recalcSeats(id);

  return NextResponse.json({ ok: true });
}
