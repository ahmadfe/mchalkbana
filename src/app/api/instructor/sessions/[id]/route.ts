export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireInstructor } from '@/lib/auth';
import { activeSchools, schoolChoiceFor } from '@/lib/checkin';

/** En kurs för läraren: elever med incheckning, bedömning och vilken skola som betalar. */
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
          invoiceId: true,
          payment: { select: { status: true } },
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
      bookings: session.bookings.map(({ payment, invoiceId, bookedBySchoolUser, ...b }) => ({
        ...b,
        schoolName: bookedBySchoolUser?.name ?? null,
        schoolLocked: schoolChoiceFor({ bookedBySchoolUserId: b.bookedBySchoolUserId, invoiceId, payment }).locked,
      })),
    },
    schools: await activeSchools(),
  });
}
