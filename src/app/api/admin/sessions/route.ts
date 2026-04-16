export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

const SESSION_INCLUDE = {
  course: true,
  school: true,
  assignedSchoolUsers: { select: { id: true, name: true } },
  schoolAllocations: {
    select: { schoolUserId: true, allocatedSeats: true, schoolUser: { select: { name: true } } },
  },
} as const;

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const sessions = await prisma.session.findMany({
    include: SESSION_INCLUDE,
    orderBy: { startTime: 'asc' },
  });
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const { courseId, schoolId, startTime, endTime, seatLimit, visibility, assignedSchoolUserIds, receiptMessage, comboRisk1SessionId, comboRisk2SessionId } = await request.json();
  if (!courseId || !schoolId || !startTime || !endTime || !seatLimit) {
    return NextResponse.json({ error: 'Obligatoriska fält saknas' }, { status: 400 });
  }

  const seats = parseInt(seatLimit);
  const ids: number[] = Array.isArray(assignedSchoolUserIds)
    ? assignedSchoolUserIds.map(Number).filter(Boolean)
    : [];

  const session = await prisma.session.create({
    data: {
      courseId: parseInt(courseId),
      schoolId: parseInt(schoolId),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      seatLimit: seats,
      seatsAvailable: seats,
      visibility: visibility || 'public',
      receiptMessage: receiptMessage || '',
      ...(comboRisk1SessionId ? { comboRisk1SessionId: parseInt(comboRisk1SessionId) } : {}),
      ...(comboRisk2SessionId ? { comboRisk2SessionId: parseInt(comboRisk2SessionId) } : {}),
      ...(visibility === 'school' && ids.length > 0
        ? { assignedSchoolUsers: { connect: ids.map((id) => ({ id })) } }
        : {}),
    },
    include: SESSION_INCLUDE,
  });
  return NextResponse.json({ session }, { status: 201 });
}
