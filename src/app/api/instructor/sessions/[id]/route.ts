export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireInstructor } from '@/lib/auth';

/** En kurs för läraren: elever med incheckning, bedömning och vilken skola de kommer från (skolan väljs av admin). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const authUser = await requireInstructor(request);
  if (!authUser) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const sessionId = parseInt(params.id);
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      course: { select: { titleSv: true, type: true, behorighet: true } },
      assignedSchoolUsers: { select: { id: true } },
      bookings: {
        where: { status: { not: 'Canceled' } },
        select: {
          id: true,
          guestName: true,
          personnummer: true,
          guestPhone: true,
          guestEmail: true,
          result: true,
          resultNote: true,
          bookedByRole: true,
          checkedInAt: true,
          idType: true,
          note: true,
          bookedBySchoolUserId: true,
          bookedBySchoolUser: { select: { name: true } },
          user: { select: { name: true, phone: true, email: true } },
        },
        orderBy: { bookingTime: 'asc' },
      },
    },
  });

  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });
  if (!session.assignedSchoolUsers.some(u => u.id === authUser.userId)) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  return NextResponse.json({
    session: {
      id: session.id,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      resultsSentAt: session.resultsSentAt?.toISOString() ?? null,
      course: session.course,
      bookings: session.bookings.map(({ bookedBySchoolUser, ...b }) => ({
        ...b,
        schoolName: bookedBySchoolUser?.name ?? null,
      })),
    },
  });
}
