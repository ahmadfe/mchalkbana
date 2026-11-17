export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { expectedPrice } from '@/lib/kurser';

/**
 * Obetalda elever: bokningar som inte är avbokade, saknar betald betalning och inte har någon trafikskola.
 * Alla oavsett datum (så att inget gammalt glöms bort). Bara ägaren.
 */
export async function GET(request: Request) {
  if (!(await requireOwner(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'Canceled' },
      bookedBySchoolUserId: null,
      invoiceId: null,
      session: { status: { not: 'canceled' } },
      // Betald, reserverad (Klarna) eller återbetald räknas inte som obetald
      OR: [{ payment: null }, { payment: { status: { notIn: ['Succeeded', 'Authorized', 'Refunded'] } } }],
    },
    select: {
      id: true, guestName: true, personnummer: true, guestPhone: true, guestEmail: true, studentId: true,
      attendance: true, payNote: true, price: true, priceOverride: true, bookedBySchoolUserId: true,
      user: { select: { name: true, phone: true, email: true } },
      payment: { select: { amount: true, status: true, provider: true } },
      session: { select: { id: true, startTime: true, endTime: true, discountPrice: true, course: { select: { titleSv: true, price: true } } } },
    },
    orderBy: { session: { startTime: 'desc' } },
  });

  const rows = bookings.map(b => ({
    bookingId: b.id,
    name: b.guestName || b.user?.name || '–',
    personnummer: b.personnummer,
    phone: b.guestPhone || b.user?.phone || null,
    email: b.guestEmail || b.user?.email || null,
    studentId: b.studentId,
    attendance: b.attendance,
    note: b.payNote,
    // En påbörjad men inte klar betalning (t.ex. avbruten Swish) – visa vilken
    pending: b.payment ? `${b.payment.provider} ${b.payment.status}` : null,
    amount: expectedPrice({ ...b, payment: null }, b.session, null),
    slot: {
      id: b.session.id,
      startTime: b.session.startTime.toISOString(),
      endTime: b.session.endTime.toISOString(),
      course: b.session.course.titleSv.trim(),
    },
  }));

  return NextResponse.json({ rows });
}
