export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { meetingPlaceFor } from '@/lib/allocations';
import { requireAdmin } from '@/lib/auth';
import { ATTENDANCE_VALUES, courseEmailInfo, recalcSeats } from '@/lib/kurser';
import { sendCancellationEmail } from '@/lib/email';

/** Ändrar närvaro eller avbokar en deltagare. */
export async function PATCH(request: Request, { params }: { params: { bookingId: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.bookingId);
  const { attendance, cancel, notify } = await request.json();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { session: { include: { course: true, school: true } } },
  });
  if (!booking) return NextResponse.json({ error: 'Bokningen hittades inte' }, { status: 404 });

  if (attendance !== undefined) {
    if (!ATTENDANCE_VALUES.includes(attendance)) return NextResponse.json({ error: 'Ogiltig närvaro' }, { status: 400 });
    await prisma.booking.update({ where: { id }, data: { attendance } });
  }

  if (cancel && booking.status !== 'Canceled') {
    await prisma.booking.update({ where: { id }, data: { status: 'Canceled' } });
    await recalcSeats(booking.sessionId);
    if (notify && booking.guestEmail) {
      await sendCancellationEmail({
        recipientEmail: booking.guestEmail,
        recipientName: booking.guestName || 'Kund',
        bookingId: id,
        ...courseEmailInfo(booking.session),
        location: await meetingPlaceFor(booking, courseEmailInfo(booking.session).location),
        cancelledBy: 'admin',
      }).catch(err => console.error('[Deltagare] Avbokningsmejl misslyckades:', err));
    }
  }

  return NextResponse.json({ ok: true });
}
