import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const vehicle = searchParams.get('vehicle');
  const availableOnly = searchParams.get('availableOnly') === 'true';
  const includeSchool = searchParams.get('includeSchool') === 'true';

  let authUser = null;
  if (includeSchool) {
    authUser = await getAuthUserFromRequest(request);
  }

  const isAdmin = authUser?.role === 'admin';
  const isSchool = authUser?.role === 'school';

  let visibilityFilter = {};

  if (isAdmin) {
    // Admin sees everything
    visibilityFilter = {};
  } else if (isSchool) {
    // School sees only sessions specifically assigned to them
    visibilityFilter = {
      visibility: 'school',
      assignedSchoolUserId: authUser!.userId,
    };
  } else {
    // Public: only public sessions
    visibilityFilter = { visibility: 'public' };
  }

  const sessions = await prisma.session.findMany({
    where: {
      ...visibilityFilter,
      ...(availableOnly ? { seatsAvailable: { gt: 0 } } : {}),
      course: {
        ...(type ? { type } : {}),
        ...(vehicle ? { vehicle } : {}),
      },
    },
    include: { course: true, school: true },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json({ sessions });
}
