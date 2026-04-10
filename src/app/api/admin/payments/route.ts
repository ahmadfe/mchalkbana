export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      booking: {
        include: {
          session: { include: { course: true, school: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json({ payments });
}
