import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const paymentId = parseInt(params.id);
  if (isNaN(paymentId)) return NextResponse.json({ error: 'Ogiltigt ID' }, { status: 400 });

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });

  if (!payment) return NextResponse.json({ error: 'Betalning hittades inte' }, { status: 404 });
  if (payment.status === 'Refunded') return NextResponse.json({ error: 'Redan återbetald' }, { status: 400 });

  // Mark payment as refunded and booking as canceled, restore seat
  const [updated] = await prisma.$transaction([
    prisma.payment.update({ where: { id: paymentId }, data: { status: 'Refunded' } }),
    prisma.booking.update({ where: { id: payment.bookingId }, data: { status: 'Canceled' } }),
    prisma.session.update({
      where: { id: payment.booking.sessionId },
      data: { seatsAvailable: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ payment: updated });
}
