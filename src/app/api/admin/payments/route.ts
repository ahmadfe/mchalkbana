export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOwner } from '@/lib/auth';

export async function GET(request: Request) {
  // Betalningarna visas bara för ägaren
  if (!(await requireOwner(request))) {
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
