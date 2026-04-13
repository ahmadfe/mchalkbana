import { prisma } from '@/lib/db';

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export async function GET(_: Request, { params }: { params: { bookingId: string } }) {
  const bookingId = parseInt(params.bookingId);
  if (isNaN(bookingId)) return new Response('Not found', { status: 404 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true, school: true } } },
  });

  if (!booking) return new Response('Not found', { status: 404 });

  const session = booking.session;
  const courseName = `Uppsala Halkbana – ${session.course.titleSv} (${session.course.behorighet})`;
  const location = session.course.location || session.school.name;
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  const now = new Date();

  const description = [
    `Boknings-ID: #${bookingId}`,
    `Kurs: ${session.course.titleSv}`,
    `Körkortsbehörighet: ${session.course.behorighet}`,
    `Frågor? Ring 07 07 66 66 61`,
  ].join('\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Uppsala Halkbana//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${bookingId}@uppsalahalkbana.se`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${courseName}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="kurs-${bookingId}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
