import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { moveBooking } from '@/lib/moveBooking';

/** Äldre adminsidans flytt – samma regler som kurssidans "Flytta", skickar alltid ny bekräftelse. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { newSessionId } = await request.json();
  if (!newSessionId) return NextResponse.json({ error: 'newSessionId krävs' }, { status: 400 });
  const result = await moveBooking(parseInt(params.id), Number(newSessionId), true);
  return result.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
