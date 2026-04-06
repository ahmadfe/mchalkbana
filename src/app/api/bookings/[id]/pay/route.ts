import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });

  const bookingId = parseInt(params.id);
  const { provider } = await request.json();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true } } },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.userId !== authUser.userId) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  if (booking.status === 'Paid') return NextResponse.json({ error: 'Bokning redan betald' }, { status: 400 });

  // Simulate payment processing
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const [updatedBooking] = await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: 'Paid' } }),
    prisma.payment.create({
      data: {
        bookingId,
        amount: booking.session.course.price,
        provider: provider || 'Stripe',
        status: 'Succeeded',
        transactionId,
      },
    }),
  ]);

  return NextResponse.json({ booking: updatedBooking, transactionId });
}
