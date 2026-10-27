export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { buildSie } from '@/lib/sie';

/** SIE 4-fil för bokföringen: ?from=2026-11&to=2026-12&payments=1 */
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') || from;
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to) || to < from) {
    return NextResponse.json({ error: 'Ange period som ÅÅÅÅ-MM' }, { status: 400 });
  }
  const { file, filename } = await buildSie(from, to, { payments: url.searchParams.get('payments') !== '0' });
  return new NextResponse(new Uint8Array(file), {
    headers: { 'Content-Type': 'text/plain; charset=IBM437', 'Content-Disposition': `attachment; filename="${filename}"` },
  });
}
