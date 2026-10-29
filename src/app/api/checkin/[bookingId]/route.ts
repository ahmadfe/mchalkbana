export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUserFromRequest, isDisabled } from '@/lib/auth';
import { checkIn, setBookingSchool, undoCheckIn } from '@/lib/checkin';

/** Användaren som checkar in – inaktiverade lärare stängs ute. */
async function currentUser(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user || (user.role === 'instructor' && (await isDisabled(user.userId)))) return null;
  return user;
}

// Används av både admin (kurssidan) och lärare (lärarportalen).
// schoolUserId: vilken trafikskola eleven kommer från (null = privat, utelämnat = oförändrat).
export async function POST(request: Request, { params }: { params: { bookingId: string } }) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });
  const { idType, personnummer, instructorId, schoolUserId } = await request.json();
  const bookingId = Number(params.bookingId);
  const result = await checkIn(bookingId, user, idType, personnummer || undefined, instructorId ? Number(instructorId) : undefined);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  if (schoolUserId !== undefined) {
    const school = await setBookingSchool(bookingId, user, schoolUserId === null ? null : Number(schoolUserId));
    // Incheckningen är gjord – säg till om skolvalet inte gick igenom
    if (!school.ok) return NextResponse.json({ ok: true, warning: school.error });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { bookingId: string } }) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });
  const result = await undoCheckIn(Number(params.bookingId), user);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
