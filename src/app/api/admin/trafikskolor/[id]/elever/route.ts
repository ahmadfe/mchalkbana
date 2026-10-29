export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { addSchoolBooking } from '@/lib/schoolBookings';

/** Admin lägger till en elev åt skolan, t.ex. när skolan ringer. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const body = await request.json();
  const result = await addSchoolBooking(Number(params.id), { ...body, sessionId: Number(body.sessionId) }, { by: 'admin' });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
