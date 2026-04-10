import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cards = await prisma.infoCard.findMany({
    where: { visible: true },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json({ cards });
}
