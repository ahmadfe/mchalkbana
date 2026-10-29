import { prisma } from './db';
import { recalcSeats } from './kurser';
import { meetingPlaceFor } from './allocations';
import { linkBookingToStudent } from './students';
import { sendBookingConfirmationEmail, sendCancellationEmail, sendInternalBookingNotification } from './email';

/*
 * En trafikskolas elever på ett pass – samma regler oavsett om skolan själv (skolportalen)
 * eller admin (Trafikskolor-sidan, t.ex. efter ett telefonsamtal) lägger till eller tar bort.
 * Skillnad: admin får lägga till efter "fyll senast" så länge skolan har platser kvar,
 * och personalen får ingen intern notis om sådant de själva gjort.
 */

export interface SchoolStudentInput {
  sessionId: number;
  guestName: string;
  personnummer: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  note?: string | null;
  sendConfirmation?: boolean;
}

const tz = { timeZone: 'Europe/Stockholm' } as const;
const when = (start: Date, end: Date) => ({
  courseDate: start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...tz }),
  courseTime: `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz })}`,
});

export async function addSchoolBooking(
  schoolUserId: number,
  input: SchoolStudentInput,
  { by }: { by: 'school' | 'admin' },
): Promise<{ error: string; status: number } | { bookingId: number }> {
  const { sessionId, guestName, personnummer } = input;
  if (!sessionId || !guestName?.trim() || !personnummer?.trim()) return { error: 'Session, namn och personnummer krävs', status: 400 };

  const [session, school] = await Promise.all([
    prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        course: true,
        school: true,
        assignedSchoolUsers: { select: { id: true } },
        schoolAllocations: { where: { schoolUserId }, select: { allocatedSeats: true, meetingPlace: true, fillBy: true, releasedAt: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: schoolUserId }, select: { name: true, role: true } }),
  ]);
  if (!session) return { error: 'Session hittades inte', status: 404 };
  if (!school || school.role !== 'school') return { error: 'Trafikskolan hittades inte', status: 404 };
  if (session.status === 'canceled') return { error: 'Kursen är inställd', status: 400 };
  // Passet är låst när det har börjat (det syns då under Arkiverade)
  if (session.startTime <= new Date()) return { error: 'Passet har redan börjat och kan inte ändras', status: 400 };

  const isAssigned = session.assignedSchoolUsers.some(u => u.id === schoolUserId);
  const allocation = session.schoolAllocations[0] ?? null;
  if (!isAssigned && !allocation) {
    return { error: by === 'admin' ? `${school.name} har inga platser på den här kursen – reservera platser först` : 'Detta pass är inte tilldelat din skola', status: 403 };
  }
  if (session.visibility === 'school' && session.seatsAvailable <= 0) return { error: 'Inga platser kvar', status: 409 };

  if (allocation) {
    if (allocation.releasedAt) {
      return {
        error: by === 'admin'
          ? 'Skolans outnyttjade platser har släppts – ändra reservationen (nytt "fyll senast") först'
          : 'Sista dag att fylla platserna har passerat',
        status: 400,
      };
    }
    // Skolan själv är låst efter "fyll senast"; admin får fylla på så länge platserna inte släppts
    if (by === 'school' && allocation.fillBy && allocation.fillBy < new Date()) {
      return { error: 'Sista dag att fylla platserna har passerat', status: 400 };
    }
    const used = await prisma.booking.count({ where: { sessionId, bookedBySchoolUserId: schoolUserId, status: { not: 'Canceled' } } });
    if (used >= allocation.allocatedSeats) {
      return {
        error: by === 'admin'
          ? `${school.name} har fyllt sina ${allocation.allocatedSeats} platser – öka antalet platser i reservationen först`
          : `Din skola har nått sin platskvot (${used}/${allocation.allocatedSeats} platser bokade)`,
        status: 409,
      };
    }
  }

  const existing = await prisma.booking.findFirst({ where: { sessionId, personnummer, status: { not: 'Canceled' } } });
  if (existing) return { error: 'Detta personnummer är redan bokat på detta pass', status: 409 };

  const booking = await prisma.booking.create({
    data: {
      sessionId,
      guestName: guestName.trim(),
      personnummer: personnummer.trim(),
      guestPhone: input.guestPhone || null,
      guestEmail: input.guestEmail || null,
      status: 'Confirmed',
      bookedByRole: 'school',
      note: typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 500) : null,
      bookedBySchoolUserId: schoolUserId,
    },
  });
  await recalcSeats(sessionId);
  await linkBookingToStudent(booking.id);

  const location = allocation?.meetingPlace || session.meetingPlace || session.course.location || session.school.name;
  const courseName = `${session.course.titleSv} (${session.course.behorighet})`;
  const { courseDate, courseTime } = when(session.startTime, session.endTime);

  if (input.guestEmail && input.sendConfirmation) {
    await sendBookingConfirmationEmail({
      recipientEmail: input.guestEmail,
      recipientName: guestName,
      bookingId: booking.id,
      courseName,
      courseDate,
      courseTime,
      location,
      schoolName: school.name,
      personnummer,
      phone: input.guestPhone || null,
    });
  }
  if (by === 'school') {
    sendInternalBookingNotification({
      bookingId: booking.id,
      studentName: guestName,
      personnummer,
      phone: input.guestPhone || null,
      email: input.guestEmail || null,
      courseName,
      courseDate,
      courseTime,
      location,
      bookedBy: 'school',
      status: 'Confirmed',
    }).catch(err => console.error('[School booking] Internal notification failed:', err));
  }
  return { bookingId: booking.id };
}

export async function removeSchoolBooking(
  schoolUserId: number,
  bookingId: number,
  { by }: { by: 'school' | 'admin' },
): Promise<{ error: string; status: number } | { ok: true }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: { include: { course: true, school: true } }, user: { select: { name: true, email: true } } },
  });
  if (!booking) return { error: 'Bokning hittades inte', status: 404 };
  if (booking.bookedBySchoolUserId !== schoolUserId) return { error: 'Ej behörig att ta bort denna bokning', status: 403 };
  if (booking.session.startTime <= new Date()) return { error: 'Passet har redan börjat – arkiverade pass kan inte ändras', status: 400 };
  if (booking.invoiceId) return { error: 'Eleven finns på en faktura – kreditera fakturan först', status: 400 };

  await prisma.booking.delete({ where: { id: bookingId } });
  await recalcSeats(booking.sessionId);

  const s = booking.session;
  const recipientEmail = booking.guestEmail || booking.user?.email || null;
  const courseName = `${s.course.titleSv} (${s.course.behorighet})`;
  const { courseDate, courseTime } = when(s.startTime, s.endTime);
  const location = await meetingPlaceFor(booking, s.meetingPlace || s.course.location || s.school?.name || '');
  if (recipientEmail) {
    sendCancellationEmail({
      recipientEmail,
      recipientName: booking.guestName || booking.user?.name || 'Kund',
      bookingId,
      courseName,
      courseDate,
      courseTime,
      location,
      cancelledBy: by,
    }).catch(err => console.error('[School cancel] Email failed:', err));
  }
  if (by === 'school') {
    sendInternalBookingNotification({
      bookingId,
      studentName: booking.guestName || booking.user?.name || 'Okänd',
      personnummer: booking.personnummer ?? '–',
      phone: booking.guestPhone,
      email: booking.guestEmail || booking.user?.email,
      courseName,
      courseDate,
      courseTime,
      location,
      bookedBy: 'school',
      status: 'Canceled',
      cancelledBy: 'school',
    }).catch(err => console.error('[School cancel] Internal cancel notification failed:', err));
  }
  return { ok: true };
}
