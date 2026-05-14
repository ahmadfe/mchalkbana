import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'instructor') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const bookingId = parseInt(params.id);
  const { result, resultNote } = await request.json();

  if (result !== 'passed' && result !== 'failed' && result !== null) {
    return NextResponse.json({ error: 'Ogiltigt resultat' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { assignedSchoolUsers: { select: { id: true } } } } },
  });
  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });

  const isAssigned = booking.session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  if (!isAssigned) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { result, resultNote: resultNote ?? null },
  });

  return NextResponse.json({ booking: updated });
}
