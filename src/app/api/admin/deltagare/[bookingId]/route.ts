export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { meetingPlaceFor } from '@/lib/allocations';
import { requireAdmin } from '@/lib/auth';
import { ATTENDANCE_VALUES, courseEmailInfo, recalcSeats } from '@/lib/kurser';
import { sendCancellationEmail } from '@/lib/email';
import { setComboParts } from '@/lib/checkin';

/** Ändrar närvaro, delar (kombokurs), pris eller avbokar en deltagare. */
export async function PATCH(request: Request, { params }: { params: { bookingId: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.bookingId);
  const { attendance, cancel, notify, comboParts, price } = await request.json();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { session: { include: { course: true, school: true } }, payment: { select: { id: true } } },
  });
  if (!booking) return NextResponse.json({ error: 'Bokningen hittades inte' }, { status: 404 });

  if (comboParts !== undefined) {
    const result = await setComboParts(id, comboParts);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Pris för hand (null = tillbaka till ordinarie/skolans pris). Låst när eleven betalat eller fakturerats.
  if (price !== undefined) {
    if (booking.payment) return NextResponse.json({ error: 'Eleven har redan betalat – priset kan inte ändras' }, { status: 400 });
    if (booking.invoiceId) return NextResponse.json({ error: 'Eleven finns redan på en faktura – kreditera fakturan först' }, { status: 400 });
    if (price !== null && (!Number.isInteger(price) || price < 0)) return NextResponse.json({ error: 'Priset ska vara hela kronor' }, { status: 400 });
    await prisma.booking.update({ where: { id }, data: { priceOverride: price } });
  }

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
