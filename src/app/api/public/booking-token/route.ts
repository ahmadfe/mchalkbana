export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signBookingToken } from '@/lib/booking-token';
import { sendSlotChangeLinkEmail } from '@/lib/email';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email } = body;
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'E-post krävs' }, { status: 400 });
  }
  const normalizedEmail = email.toLowerCase().trim();

  const allBookings = await prisma.booking.findMany({
    where: {
      OR: [
        { guestEmail: normalizedEmail },
        { user: { email: normalizedEmail } },
      ],
      status: { not: 'Canceled' },
    },
    include: { session: { include: { course: true, school: true } } },
    orderBy: { bookingTime: 'desc' },
    take: 20,
  });

  // Filter to upcoming sessions only
  const now = new Date();
  const bookings = allBookings.filter(b => new Date(b.session.startTime) > now).slice(0, 5);

  // Always return 200 to prevent email enumeration
  if (bookings.length === 0) return NextResponse.json({ sent: true });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://uppsalahalkbana.se';

  for (const booking of bookings) {
    const token = await signBookingToken(booking.id);
    const changeUrl = `${baseUrl}/sv/byt-tid?token=${token}`;
    const start = new Date(booking.session.startTime);
    await sendSlotChangeLinkEmail({
      recipientEmail: normalizedEmail,
      recipientName: booking.guestName || 'Kund',
      bookingId: booking.id,
      courseName: `${booking.session.course.titleSv} (${booking.session.course.behorighet})`,
      courseDate: start.toLocaleDateString('sv-SE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm',
      }),
      changeUrl,
    }).catch((err) => console.error('[booking-token] Email failed:', err));
  }

  return NextResponse.json({ sent: true });
}
