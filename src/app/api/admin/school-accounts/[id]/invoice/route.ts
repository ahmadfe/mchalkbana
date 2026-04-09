import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendSchoolInvoiceEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const schoolUserId = parseInt(params.id);
  const { month } = await request.json();

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Ange månad i format YYYY-MM' }, { status: 400 });
  }

  const [year, mon] = month.split('-').map(Number);
  const from = new Date(year, mon - 1, 1);
  const to = new Date(year, mon, 1);

  const schoolUser = await prisma.user.findUnique({
    where: { id: schoolUserId },
    select: { id: true, name: true, email: true },
  });
  if (!schoolUser) return NextResponse.json({ error: 'Skola hittades inte' }, { status: 404 });

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'Canceled' },
      bookedByRole: 'school',
      bookingTime: { gte: from, lt: to },
      session: { assignedSchoolUserId: schoolUserId },
    },
    include: {
      session: { include: { course: true } },
    },
    orderBy: { session: { startTime: 'asc' } },
  });

  const sessionMap: Record<number, {
    courseName: string;
    sessionDate: string;
    pricePerStudent: number;
    count: number;
  }> = {};

  for (const b of bookings) {
    const sid = b.sessionId;
    if (!sessionMap[sid]) {
      sessionMap[sid] = {
        courseName: b.session.course.titleSv,
        sessionDate: new Date(b.session.startTime).toLocaleDateString('sv-SE'),
        pricePerStudent: b.session.course.price,
        count: 0,
      };
    }
    sessionMap[sid].count++;
  }

  const rows = Object.values(sessionMap).map((s) => ({
    courseName: s.courseName,
    sessionDate: s.sessionDate,
    studentCount: s.count,
    pricePerStudent: s.pricePerStudent,
    subtotal: s.count * s.pricePerStudent,
  }));

  const totalStudents = rows.reduce((sum, r) => sum + r.studentCount, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.subtotal, 0);

  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });

  await sendSchoolInvoiceEmail({
    recipientEmail: schoolUser.email,
    schoolName: schoolUser.name,
    customerNumber: schoolUser.id,
    month: monthLabel,
    rows,
    totalStudents,
    totalAmount,
  });

  return NextResponse.json({ success: true });
}
