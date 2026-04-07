import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const sessions = await prisma.session.findMany({
    include: { course: true, school: true },
    orderBy: { startTime: 'asc' },
  });
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const { courseId, schoolId, startTime, endTime, seatLimit, visibility } = await request.json();
  if (!courseId || !startTime || !endTime || !seatLimit) {
    return NextResponse.json({ error: 'Obligatoriska fält saknas' }, { status: 400 });
  }

  const seats = parseInt(seatLimit);
  const session = await prisma.session.create({
    data: {
      courseId: parseInt(courseId),
      schoolId: parseInt(schoolId) || 1,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      seatLimit: seats,
      seatsAvailable: seats,
      visibility: visibility || 'public',
    },
    include: { course: true, school: true },
  });
  return NextResponse.json({ session }, { status: 201 });
}
