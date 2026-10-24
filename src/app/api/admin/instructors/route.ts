export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const instructors = await prisma.user.findMany({
    where: { role: 'instructor' },
    select: {
      id: true, name: true, email: true, phone: true, createdAt: true,
      _count: { select: { assignedSessions: { where: { startTime: { gte: new Date() } } } } },
    },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ instructors });
}
