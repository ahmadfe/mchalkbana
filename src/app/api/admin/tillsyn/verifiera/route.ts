export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { verifyExportCode } from '@/lib/tillsyn';

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { code } = await request.json();
  const result = await verifyExportCode(admin.userId, String(code ?? ''));
  return 'error' in result
    ? NextResponse.json({ error: result.error }, { status: 400 })
    : NextResponse.json({ token: result.token });
}
