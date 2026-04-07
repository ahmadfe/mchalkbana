import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const data = await request.json();
  const course = await prisma.course.update({
    where: { id: parseInt(params.id) },
    data: { ...data, price: data.price ? parseInt(data.price) : undefined },
  });
  return NextResponse.json({ course });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const courseId = parseInt(params.id);

  // Delete in order: payments → bookings → sessions → course
  const sessions = await prisma.session.findMany({ where: { courseId }, select: { id: true } });
  const sessionIds = sessions.map((s) => s.id);

  if (sessionIds.length > 0) {
    const bookings = await prisma.booking.findMany({ where: { sessionId: { in: sessionIds } }, select: { id: true } });
    const bookingIds = bookings.map((b) => b.id);
    if (bookingIds.length > 0) {
      await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
  }

  await prisma.course.delete({ where: { id: courseId } });
  return NextResponse.json({ success: true });
}
