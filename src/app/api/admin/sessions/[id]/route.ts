import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

const SESSION_INCLUDE = {
  course: true,
  school: true,
  assignedSchoolUsers: { select: { id: true, name: true, role: true } },
  schoolAllocations: {
    select: { schoolUserId: true, allocatedSeats: true, schoolUser: { select: { name: true } } },
  },
} as const;

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const sessionId = parseInt(params.id);
  const { assignedSchoolUserIds, schoolAllocations, ...data } = await request.json();

  const ids: number[] = Array.isArray(assignedSchoolUserIds)
    ? assignedSchoolUserIds.map(Number).filter(Boolean)
    : [];

  // Update the session itself
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: {
      ...(data.startTime ? { startTime: new Date(data.startTime) } : {}),
      ...(data.endTime ? { endTime: new Date(data.endTime) } : {}),
      ...(data.seatLimit ? { seatLimit: parseInt(data.seatLimit) } : {}),
      ...(data.seatsAvailable !== undefined ? { seatsAvailable: parseInt(data.seatsAvailable) } : {}),
      ...(data.visibility ? { visibility: data.visibility } : {}),
      ...(data.receiptMessage !== undefined ? { receiptMessage: data.receiptMessage } : {}),
      ...(data.visibility === 'school'
        ? { assignedSchoolUsers: { set: ids.map((id) => ({ id })) } }
        : data.visibility === 'public' ? { assignedSchoolUsers: { set: [] } } : {}),
    },
    include: SESSION_INCLUDE,
  });

  // Replace school allocations if provided
  if (Array.isArray(schoolAllocations)) {
    await prisma.sessionSchoolAllocation.deleteMany({ where: { sessionId } });

    const toCreate = (schoolAllocations as { schoolUserId: number; seats: number }[])
      .filter((a) => a.seats > 0);

    if (toCreate.length > 0) {
      await prisma.sessionSchoolAllocation.createMany({
        data: toCreate.map((a) => ({
          sessionId,
          schoolUserId: a.schoolUserId,
          allocatedSeats: a.seats,
        })),
      });
    }

    // Recalculate public seatsAvailable = seatLimit - totalSchoolAllocations - publicBookings
    const totalAllocated = toCreate.reduce((sum, a) => sum + a.seats, 0);
    const [publicBookings, sess] = await Promise.all([
      prisma.booking.count({
        where: { sessionId, status: { not: 'Canceled' }, bookedBySchoolUserId: null },
      }),
      prisma.session.findUnique({ where: { id: sessionId }, select: { seatLimit: true, visibility: true } }),
    ]);
    const newPublicSeats = Math.max(0, (sess?.seatLimit ?? 0) - totalAllocated - publicBookings);
    // If there are remaining public seats, make the session public so it shows in the course listing
    const newVisibility = newPublicSeats > 0 ? 'public' : (sess?.visibility ?? 'public');
    await prisma.session.update({
      where: { id: sessionId },
      data: { seatsAvailable: newPublicSeats, visibility: newVisibility },
    });
  }

  // Return fresh session with updated allocations
  const updated = await prisma.session.findUnique({
    where: { id: sessionId },
    include: SESSION_INCLUDE,
  });

  return NextResponse.json({ session: updated });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  await prisma.session.delete({ where: { id: parseInt(params.id) } });
  return NextResponse.json({ success: true });
}
