export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/** En trafikskola som skolan själv ser den – kurser och elever – plus priser och fakturor. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.id);
  const school = await prisma.user.findFirst({
    where: { id, role: 'school' },
    select: { id: true, name: true, email: true, phone: true, orgNr: true, billingAddress: true, createdAt: true },
  });
  if (!school) return NextResponse.json({ error: 'Trafikskolan hittades inte' }, { status: 404 });

  const [sessions, courses, prices, invoices] = await Promise.all([
    prisma.session.findMany({
      where: {
        status: { not: 'canceled' },
        OR: [
          { schoolAllocations: { some: { schoolUserId: id } } },
          { assignedSchoolUsers: { some: { id } } },
          { bookings: { some: { bookedBySchoolUserId: id, status: { not: 'Canceled' } } } },
        ],
      },
      orderBy: { startTime: 'asc' },
      include: {
        course: { select: { titleSv: true, type: true, location: true } },
        school: { select: { name: true } },
        schoolAllocations: { where: { schoolUserId: id } },
        assignedSchoolUsers: { where: { id }, select: { id: true } },
        bookings: {
          where: { bookedBySchoolUserId: id, status: { not: 'Canceled' } },
          orderBy: { bookingTime: 'asc' },
          select: { id: true, guestName: true, personnummer: true, guestPhone: true, guestEmail: true, note: true, attendance: true, checkedInAt: true, invoiceId: true },
        },
      },
    }),
    prisma.course.findMany({ orderBy: { titleSv: 'asc' }, select: { id: true, titleSv: true, price: true } }),
    prisma.schoolCoursePrice.findMany({ where: { schoolUserId: id }, select: { courseId: true, price: true } }),
    prisma.invoice.findMany({
      where: { schoolUserId: id },
      orderBy: { number: 'desc' },
      select: { id: true, number: true, period: true, status: true, dueDate: true, issueDate: true, total: true, creditOfId: true },
    }),
  ]);

  return NextResponse.json({
    school,
    prices: courses.map(c => ({ courseId: c.id, title: c.titleSv, listPrice: c.price, price: prices.find(p => p.courseId === c.id)?.price ?? null })),
    invoices,
    courses: sessions.map(s => {
      const a = s.schoolAllocations[0] ?? null;
      return {
        id: s.id,
        title: s.course.titleSv,
        type: s.course.type,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        seatLimit: s.seatLimit,
        courseMeetingPlace: s.meetingPlace || s.course.location || s.school.name,
        assigned: s.assignedSchoolUsers.length > 0,
        allocation: a && {
          seats: a.allocatedSeats,
          meetingPlace: a.meetingPlace,
          fillBy: a.fillBy?.toISOString() ?? null,
          message: a.message,
          released: !!a.releasedAt,
        },
        students: s.bookings.map(b => ({
          bookingId: b.id, name: b.guestName, personnummer: b.personnummer, phone: b.guestPhone, email: b.guestEmail,
          note: b.note, attendance: b.attendance, checkedIn: !!b.checkedInAt, invoiced: b.invoiceId !== null,
        })),
      };
    }),
  });
}

/** Telefon och faktureringsuppgifter. Inloggning och lösenord sköts under Personal. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.id);
  const body = await request.json();
  const school = await prisma.user.findFirst({ where: { id, role: 'school' }, select: { id: true } });
  if (!school) return NextResponse.json({ error: 'Trafikskolan hittades inte' }, { status: 404 });
  await prisma.user.update({
    where: { id },
    data: {
      orgNr: String(body.orgNr ?? '').trim(),
      billingAddress: String(body.billingAddress ?? '').trim(),
      phone: String(body.phone ?? '').trim() || null,
    },
  });
  return NextResponse.json({ ok: true });
}
