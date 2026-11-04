export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { moveBooking, moveOptions } from '@/lib/moveBooking';

/** Tillfällen eleven kan flyttas till */
export async function GET(request: Request, { params }: { params: { bookingId: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const data = await moveOptions(Number(params.bookingId));
  return data ? NextResponse.json(data) : NextResponse.json({ error: 'Bokningen hittades inte' }, { status: 404 });
}

/** Flytta eleven: { sessionId, notify } */
export async function POST(request: Request, { params }: { params: { bookingId: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { sessionId, notify } = await request.json();
  const result = await moveBooking(Number(params.bookingId), Number(sessionId), !!notify);
  return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: result.status });
}
