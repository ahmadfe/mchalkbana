export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUserFromRequest, isDisabled } from '@/lib/auth';
import { setBookingSchool } from '@/lib/checkin';

/** Ändra vilken trafikskola eleven kommer från: { schoolUserId: number | null }. */
export async function PATCH(request: Request, { params }: { params: { bookingId: string } }) {
  const user = await getAuthUserFromRequest(request);
  if (!user || (user.role === 'instructor' && (await isDisabled(user.userId)))) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });
  const { schoolUserId } = await request.json();
  const result = await setBookingSchool(Number(params.bookingId), user, schoolUserId === null || schoolUserId === '' ? null : Number(schoolUserId));
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
