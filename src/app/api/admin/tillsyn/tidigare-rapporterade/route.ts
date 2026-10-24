export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { markLegacyReported } from '@/lib/tillsyn';

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  return NextResponse.json({ updated: await markLegacyReported() });
}
