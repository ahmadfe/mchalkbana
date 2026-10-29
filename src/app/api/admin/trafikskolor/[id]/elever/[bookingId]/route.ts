export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { removeSchoolBooking } from '@/lib/schoolBookings';

export async function DELETE(request: Request, { params }: { params: { id: string; bookingId: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const result = await removeSchoolBooking(Number(params.id), Number(params.bookingId), { by: 'admin' });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
