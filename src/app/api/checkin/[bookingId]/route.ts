export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { checkIn, undoCheckIn } from '@/lib/checkin';

// Används av både admin (kurssidan) och lärare (lärarportalen)
export async function POST(request: Request, { params }: { params: { bookingId: string } }) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });
  const { idType, personnummer, instructorId } = await request.json();
  const result = await checkIn(Number(params.bookingId), user, idType, personnummer || undefined, instructorId ? Number(instructorId) : undefined);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}

export async function DELETE(request: Request, { params }: { params: { bookingId: string } }) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });
  const result = await undoCheckIn(Number(params.bookingId), user);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
