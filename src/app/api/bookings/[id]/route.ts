import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

// Cancel a booking
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });

  const bookingId = parseInt(params.id);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.userId !== authUser.userId && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  if (booking.status === 'Canceled') {
    return NextResponse.json({ error: 'Bokning redan avbokad' }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: 'Canceled' } }),
    prisma.session.update({ where: { id: booking.sessionId }, data: { seatsAvailable: { increment: 1 } } }),
  ]);

  return NextResponse.json({ booking: updated });
}
