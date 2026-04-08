import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const bookingId = parseInt(params.id);
  if (isNaN(bookingId)) return NextResponse.json({ error: 'Ogiltigt ID' }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true },
  });

  if (!booking) return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 });

  return NextResponse.json({ status: booking.status });
}
