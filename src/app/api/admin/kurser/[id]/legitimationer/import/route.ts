export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { createOrFindStudent, enrollStudent } from '@/lib/enroll';
import { checkIn, ID_TYPES } from '@/lib/checkin';
import { normalizePersonnummer, personnummerChecksumOk } from '@/lib/pnr';
import { stockholmDay } from '@/lib/kurser';

interface Row { firstName: string; lastName: string; personnummer: string; idType: string }

/**
 * Sparar de granskade raderna: elev i registret (ny eller befintlig), anmälan till kursen och –
 * om kursen är i dag och admin bockat i det – incheckning med legitimationen från fotot.
 * Varje rad sköts för sig; resultatet visar vad som gick och inte gick.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const sessionId = Number(params.id);
  const { rows, checkIn: doCheckIn, instructorId } = (await request.json()) as { rows?: Row[]; checkIn?: boolean; instructorId?: number };
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'Inga elever att lägga till' }, { status: 400 });

  const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { startTime: true } });
  if (!session) return NextResponse.json({ error: 'Kursen hittades inte' }, { status: 404 });
  // Incheckning från foto bara på kursdagen – annars checkar läraren in på plats
  const today = stockholmDay(new Date());
  const isCourseDay = session.startTime >= today.from && session.startTime < today.to;

  const results: { name: string; ok: boolean; message: string }[] = [];
  for (const r of rows) {
    const name = `${r.firstName} ${r.lastName}`.trim();
    const pnr = normalizePersonnummer(r.personnummer);
    if (!pnr || !personnummerChecksumOk(pnr)) { results.push({ name, ok: false, message: 'Personnumret stämmer inte (kontrollsiffran)' }); continue; }

    const student = await createOrFindStudent({ firstName: r.firstName, lastName: r.lastName, personnummer: pnr });
    if ('error' in student) { results.push({ name, ok: false, message: student.error }); continue; }
    const booking = await enrollStudent(sessionId, student.studentId, { sendConfirmation: false, bookedByRole: 'admin', seats: 'physical' });
    if ('error' in booking) { results.push({ name, ok: false, message: booking.error }); continue; }

    if (doCheckIn && isCourseDay && (ID_TYPES as readonly string[]).includes(r.idType)) {
      const ci = await checkIn(booking.bookingId, user, r.idType, undefined, instructorId ? Number(instructorId) : undefined);
      results.push({ name, ok: true, message: ci.ok ? 'Anmäld och incheckad' : `Anmäld – incheckningen misslyckades: ${ci.error}` });
    } else {
      results.push({ name, ok: true, message: student.existed ? 'Anmäld (fanns redan i elevregistret)' : 'Anmäld (ny i elevregistret)' });
    }
  }
  return NextResponse.json({ results, checkedIn: doCheckIn && isCourseDay });
}
