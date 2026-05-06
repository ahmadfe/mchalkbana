import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);
  const { amount, provider, transactionId } = await request.json();

  if (!amount || !provider) {
    return NextResponse.json({ error: 'Belopp och betalningsmetod krävs' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true },
  });
  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });
  if (booking.payment) return NextResponse.json({ error: 'Betalning finns redan för denna bokning' }, { status: 400 });

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        bookingId,
        amount: Math.round(Number(amount)),
        provider,
        status: 'Succeeded',
        transactionId: transactionId?.trim() || null,
      },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'Paid' },
    }),
  ]);

  return NextResponse.json({ payment });
}
