import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireInstructor } from '@/lib/auth';

/** Bedömning och/eller notering. Bara fälten som skickas ändras, så en notering kan aldrig nollställa bedömningen. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authUser = await requireInstructor(request);
  if (!authUser) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const bookingId = parseInt(params.id);
  const body = await request.json();
  const data: { result?: string | null; resultNote?: string | null } = {};
  if ('result' in body) {
    if (body.result !== 'passed' && body.result !== 'failed' && body.result !== null) {
      return NextResponse.json({ error: 'Ogiltigt resultat' }, { status: 400 });
    }
    data.result = body.result;
  }
  if ('resultNote' in body) data.resultNote = typeof body.resultNote === 'string' && body.resultNote.trim() ? body.resultNote.trim().slice(0, 500) : null;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { assignedSchoolUsers: { select: { id: true } } } } },
  });
  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });

  const isAssigned = booking.session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  if (!isAssigned) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const updated = await prisma.booking.update({ where: { id: bookingId }, data });
  return NextResponse.json({ booking: updated });
}
