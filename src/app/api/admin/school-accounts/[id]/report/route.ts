import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const schoolUserId = parseInt(params.id);
  const url = new URL(request.url);
  const month = url.searchParams.get('month'); // e.g. "2026-04"

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Ange månad i format YYYY-MM' }, { status: 400 });
  }

  const [year, mon] = month.split('-').map(Number);
  const from = new Date(year, mon - 1, 1);
  const to = new Date(year, mon, 1);

  const schoolUser = await prisma.user.findUnique({
    where: { id: schoolUserId },
    select: { name: true, email: true },
  });
  if (!schoolUser) return NextResponse.json({ error: 'Skola hittades inte' }, { status: 404 });

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'Canceled' },
      bookedByRole: 'school',
      bookingTime: { gte: from, lt: to },
      bookedBySchoolUserId: schoolUserId,
    },
    include: {
      session: { include: { course: true } },
    },
    orderBy: { session: { startTime: 'asc' } },
  });

  // Group by session
  const sessionMap: Record<number, {
    sessionId: number;
    courseName: string;
    sessionDate: string;
    pricePerStudent: number;
    students: { name: string | null; personnummer: string | null }[];
  }> = {};

  for (const b of bookings) {
    const sid = b.sessionId;
    if (!sessionMap[sid]) {
      sessionMap[sid] = {
        sessionId: sid,
        courseName: b.session.course.titleSv,
        sessionDate: new Date(b.session.startTime).toLocaleDateString('sv-SE'),
        pricePerStudent: b.session.course.price,
        students: [],
      };
    }
    sessionMap[sid].students.push({ name: b.guestName, personnummer: b.personnummer });
  }

  const rows = Object.values(sessionMap).map((s) => ({
    sessionId: s.sessionId,
    courseName: s.courseName,
    sessionDate: s.sessionDate,
    studentCount: s.students.length,
    pricePerStudent: s.pricePerStudent,
    subtotal: s.students.length * s.pricePerStudent,
    students: s.students,
  }));

  const totalStudents = rows.reduce((sum, r) => sum + r.studentCount, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.subtotal, 0);

  return NextResponse.json({
    report: {
      schoolName: schoolUser.name,
      email: schoolUser.email,
      month,
      rows,
      totalStudents,
      totalAmount,
    },
  });
}
