export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { parsePeriod, tillsynOverview } from '@/lib/tillsyn';

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const period = parsePeriod(new URL(request.url).searchParams.get('period'));
  if (!period) return NextResponse.json({ error: 'Ogiltig period' }, { status: 400 });
  const [overview, downloads] = await Promise.all([
    tillsynOverview(period),
    prisma.exportLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  return NextResponse.json({ ...overview, downloads });
}
