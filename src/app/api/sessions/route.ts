export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { releaseExpiredAllocations } from '@/lib/allocations';

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
    // School sees sessions assigned to them OR sessions where they have an allocation
    visibilityFilter = {
      OR: [
        { visibility: 'school', assignedSchoolUsers: { some: { id: authUser!.userId } } },
        { schoolAllocations: { some: { schoolUserId: authUser!.userId } } },
      ],
    };
  } else {
    // Public: only public sessions
    visibilityFilter = { visibility: 'public' };
  }

  // Allmänheten: dölj pass som börjar inom en timme. Skolor ser passen ända tills de börjar.
  const cutoff = isAdmin ? undefined : new Date(Date.now() + (isSchool ? 0 : 60 * 60 * 1000));

  await releaseExpiredAllocations();
  const sessions = await prisma.session.findMany({
    where: {
      ...visibilityFilter,
      ...(!isAdmin ? { status: { not: 'canceled' } } : {}),
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
      comboRisk1Session: { select: { id: true, startTime: true, endTime: true, course: { select: { titleSv: true, titleEn: true } } } },
      comboRisk2Session: { select: { id: true, startTime: true, endTime: true, course: { select: { titleSv: true, titleEn: true } } } },
      ...(isSchool
        ? { schoolAllocations: { where: { schoolUserId: authUser!.userId }, select: { allocatedSeats: true, meetingPlace: true, fillBy: true, message: true, releasedAt: true } } }
        : {}),
    },
    orderBy: { startTime: 'asc' },
  });

  // For school users, flatten myAllocation onto each session
  const result = isSchool
    ? sessions
      // Släppt reservation utan egna elever – inget kvar för skolan att se
      .filter((s) => { const a = (s as any).schoolAllocations?.[0]; return !(a?.releasedAt && a.allocatedSeats === 0); })
      .map((s) => {
        const a = (s as any).schoolAllocations?.[0] ?? null;
        const alloc = a?.allocatedSeats ?? null;
        const { schoolAllocations: _, ...rest } = s as any;
        return {
          ...rest,
          myAllocation: alloc,
          myReservation: a ? { meetingPlace: a.meetingPlace, fillBy: a.fillBy, message: a.message, released: !!a.releasedAt } : null,
        };
      })
    : sessions;

  return NextResponse.json({ sessions: result });
}
