export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const [totalBookings, payments, upcomingSessions, totalStudents] = await Promise.all([
    prisma.booking.count({ where: { status: { not: 'Canceled' } } }),
    prisma.payment.aggregate({ where: { status: 'Succeeded' }, _sum: { amount: true } }),
    prisma.session.count({ where: { startTime: { gte: new Date() } } }),
    prisma.user.count({ where: { role: 'student' } }),
  ]);

  return NextResponse.json({
    totalBookings,
    revenue: payments._sum.amount ?? 0,
    upcomingSessions,
    totalStudents,
  });
}
