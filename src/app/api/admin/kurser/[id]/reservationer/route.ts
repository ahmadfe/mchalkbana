export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { parseReservation, removeReservation, saveReservation } from '@/lib/allocations';

/** Skapar eller ändrar en skolas reservation. { notify: false } skickar inget mejl. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const body = await request.json();
  const parsed = parseReservation(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await saveReservation(Number(params.id), parsed.data, { notify: body.notify !== false });
  return 'error' in result ? NextResponse.json({ error: result.error }, { status: 400 }) : NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const schoolUserId = Number(new URL(request.url).searchParams.get('schoolUserId'));
  const result = await removeReservation(Number(params.id), schoolUserId);
  return 'error' in result ? NextResponse.json({ error: result.error }, { status: 400 }) : NextResponse.json({ ok: true });
}
