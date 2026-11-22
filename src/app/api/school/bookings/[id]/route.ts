import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSchool } from '@/lib/auth';
import { removeSchoolBooking } from '@/lib/schoolBookings';

// PATCH: skolan ändrar anteckningen på en egen elev (samma anteckning som admin ser och kan ändra)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authUser = await requireSchool(request);
  if (!authUser) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { note } = await request.json().catch(() => ({}));
  if (typeof note !== 'string') return NextResponse.json({ error: 'Anteckning saknas' }, { status: 400 });
  const { count } = await prisma.booking.updateMany({
    where: { id: Number(params.id), bookedBySchoolUserId: authUser.userId, status: { not: 'Canceled' } },
    data: { note: note.trim().slice(0, 500) || null },
  });
  if (!count) return NextResponse.json({ error: 'Eleven hittades inte' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE: skolan tar bort en egen elev från ett pass som inte har börjat
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await requireSchool(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const result = await removeSchoolBooking(authUser.userId, parseInt(params.id), { by: 'school' });
  return 'error' in result ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json({ success: true });
}
