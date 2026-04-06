import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const data = await request.json();
  const session = await prisma.session.update({
    where: { id: parseInt(params.id) },
    data: {
      ...(data.startTime ? { startTime: new Date(data.startTime) } : {}),
      ...(data.endTime ? { endTime: new Date(data.endTime) } : {}),
      ...(data.seatLimit ? { seatLimit: parseInt(data.seatLimit) } : {}),
      ...(data.seatsAvailable !== undefined ? { seatsAvailable: parseInt(data.seatsAvailable) } : {}),
    },
    include: { course: true, school: true },
  });
  return NextResponse.json({ session });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  await prisma.session.delete({ where: { id: parseInt(params.id) } });
  return NextResponse.json({ success: true });
}
