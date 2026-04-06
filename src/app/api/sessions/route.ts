import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const vehicle = searchParams.get('vehicle');
  const availableOnly = searchParams.get('availableOnly') === 'true';

  const sessions = await prisma.session.findMany({
    where: {
      ...(availableOnly ? { seatsAvailable: { gt: 0 } } : {}),
      course: {
        ...(type ? { type } : {}),
        ...(vehicle ? { vehicle } : {}),
      },
    },
    include: {
      course: true,
      school: true,
    },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json({ sessions });
}
