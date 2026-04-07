import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const vehicle = searchParams.get('vehicle');
  const availableOnly = searchParams.get('availableOnly') === 'true';
  const includeSchool = searchParams.get('includeSchool') === 'true';

  // Determine if the requester is a school account
  let isSchool = false;
  if (includeSchool) {
    const authUser = await getAuthUserFromRequest(request);
    isSchool = authUser?.role === 'school' || authUser?.role === 'admin';
  }

  const sessions = await prisma.session.findMany({
    where: {
      // Only show school sessions to school/admin accounts
      ...(isSchool ? {} : { visibility: 'public' }),
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
