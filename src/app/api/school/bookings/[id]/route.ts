import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

// DELETE: school removes a student from a session
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'school') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.bookedBySchoolUserId !== authUser.userId) {
    return NextResponse.json({ error: 'Ej behörig att ta bort denna bokning' }, { status: 403 });
  }

  const sessionId = booking.sessionId;
  await prisma.booking.delete({ where: { id: bookingId } });
  await prisma.session.update({
    where: { id: sessionId },
    data: { seatsAvailable: { increment: 1 } },
  });

  return NextResponse.json({ success: true });
}
