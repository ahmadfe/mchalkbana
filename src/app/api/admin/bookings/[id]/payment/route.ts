import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const bookingId = parseInt(params.id);
  const { amount, provider, transactionId, note } = await request.json();

  const sum = Math.round(Number(amount));
  if (!provider || !Number.isFinite(sum) || sum < 0) {
    return NextResponse.json({ error: 'Belopp och betalningsmetod krävs' }, { status: 400 });
  }
  // 0 kr = gratis plats, t.ex. omprov – anteckningen förklarar varför
  if (sum === 0 && (provider !== 'free' || typeof note !== 'string' || !note.trim())) {
    return NextResponse.json({ error: 'Gratis plats (0 kr) kräver en anteckning om varför' }, { status: 400 });
  }
  if (sum > 0 && provider === 'free') return NextResponse.json({ error: 'Gratis betyder 0 kr' }, { status: 400 });

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
        amount: sum,
        provider,
        status: 'Succeeded',
        transactionId: transactionId?.trim() || null,
        note: typeof note === 'string' ? note.trim().slice(0, 300) : '',
      },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'Paid' },
    }),
  ]);

  return NextResponse.json({ payment });
}
