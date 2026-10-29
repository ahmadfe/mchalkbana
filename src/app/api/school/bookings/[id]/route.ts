import { NextResponse } from 'next/server';
import { requireSchool } from '@/lib/auth';
import { removeSchoolBooking } from '@/lib/schoolBookings';

// DELETE: skolan tar bort en egen elev från ett pass som inte har börjat
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await requireSchool(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const result = await removeSchoolBooking(authUser.userId, parseInt(params.id), { by: 'school' });
  return 'error' in result ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json({ success: true });
}
