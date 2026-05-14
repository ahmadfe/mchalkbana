import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'instructor') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const sessionId = parseInt(params.id);
  const { name, personnummer, phone, email } = await request.json();

  if (!name) return NextResponse.json({ error: 'Namn krävs' }, { status: 400 });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { assignedSchoolUsers: { select: { id: true } } },
  });
  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });

  const isAssigned = session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  if (!isAssigned) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  if (session.seatsAvailable <= 0) return NextResponse.json({ error: 'Inga platser kvar' }, { status: 400 });

  const [booking] = await prisma.$transaction([
    prisma.booking.create({
      data: {
        sessionId,
        guestName: name,
        personnummer: personnummer || null,
        guestPhone: phone || null,
        guestEmail: email || null,
        status: 'Confirmed',
        bookedByRole: 'instructor',
      },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { seatsAvailable: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ booking });
}
