export const dynamic = 'force-dynamic';
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
    // School sees only sessions assigned to them (many-to-many)
    visibilityFilter = {
      visibility: 'school',
      assignedSchoolUsers: { some: { id: authUser!.userId } },
    };
  } else {
    // Public: only public sessions
    visibilityFilter = { visibility: 'public' };
  }

  // Public users: hide sessions starting within 1 hour
  const cutoff = !isAdmin ? new Date(Date.now() + 60 * 60 * 1000) : undefined;

  const sessions = await prisma.session.findMany({
    where: {
      ...visibilityFilter,
      ...(cutoff ? { startTime: { gt: cutoff } } : {}),
      ...(availableOnly ? { seatsAvailable: { gt: 0 } } : {}),
      course: {
        ...(type ? { type } : {}),
        ...(vehicle ? { vehicle } : {}),
      },
    },
    include: {
      course: true,
      school: true,
      ...(isSchool
        ? { schoolAllocations: { where: { schoolUserId: authUser!.userId }, select: { allocatedSeats: true } } }
        : {}),
    },
    orderBy: { startTime: 'asc' },
  });

  // For school users, flatten myAllocation onto each session
  const result = isSchool
    ? sessions.map((s) => {
        const alloc = (s as any).schoolAllocations?.[0]?.allocatedSeats ?? null;
        const { schoolAllocations: _, ...rest } = s as any;
        return { ...rest, myAllocation: alloc };
      })
    : sessions;

  return NextResponse.json({ sessions: result });
}
