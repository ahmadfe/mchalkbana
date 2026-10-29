export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSchool } from '@/lib/auth';

/** Skolans egna fakturor – bara de som skickats. */
export async function GET(request: Request) {
  const user = await requireSchool(request);
  if (!user) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const invoices = await prisma.invoice.findMany({
    where: { schoolUserId: user.userId, status: { not: 'created' } },
    orderBy: { number: 'desc' },
    select: { id: true, number: true, period: true, status: true, issueDate: true, dueDate: true, total: true, paidAt: true, creditOfId: true },
  });
  return NextResponse.json({ invoices });
}
