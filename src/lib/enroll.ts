import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { courseEmailInfo, recalcSeats } from './kurser';
import { decryptPersonnummer, formatPersonnummer } from './personnummer';
import { parseStudentInput, toStudentDto } from './students';
import { sendBookingConfirmationEmail } from './email';

/*
 * Anmäla en elev ur elevregistret till en kurs – används av admin (kurssidan) och lärare (lärarportalen).
 * Samma steg för båda: sök i registret, skapa eleven om den saknas, anmäl och skicka ev. bekräftelse.
 */

export interface StudentHit { id: number; name: string; personnummer: string; phone: string; email: string }

/** Sök i elevregistret på namn, e-post, personnummer eller telefon (personnumret är krypterat, så det filtreras här). */
export async function searchStudents(rawQuery: string, limit = 8): Promise<StudentHit[]> {
  const q = rawQuery.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  if (q.length < 2) return [];
  const students = await prisma.student.findMany();
  return students
    .map(toStudentDto)
    .filter(s =>
      s.name.toLowerCase().includes(q)
      || s.email.toLowerCase().includes(q)
      || (digits.length >= 3 && (s.personnummer.replace(/\D/g, '').includes(digits) || s.phone.replace(/\D/g, '').includes(digits))))
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    .slice(0, limit)
    .map(s => ({ id: s.id, name: s.name, personnummer: s.personnummer, phone: s.phone, email: s.email }));
}

/** Skapar eleven i registret. Finns personnumret redan används den eleven (existed = true). */
export async function createOrFindStudent(body: Record<string, unknown>): Promise<{ error: string } | { studentId: number; existed: boolean }> {
  const parsed = parseStudentInput(body, { partial: false });
  if ('error' in parsed) return { error: parsed.error };
  const existing = await prisma.student.findUnique({ where: { personnummerHash: parsed.data.personnummerHash as string }, select: { id: true } });
  if (existing) return { studentId: existing.id, existed: true };
  const student = await prisma.student.create({ data: parsed.data as Prisma.StudentUncheckedCreateInput });
  return { studentId: student.id, existed: false };
}

/**
 * Anmäler eleven till kursen.
 * seats: 'public' – admin tar en publik plats (skolornas kvoter lämnas orörda);
 *        'physical' – läraren på plats får lägga till så länge kursen har fysiska platser kvar
 *        (t.ex. en elev som skolan skickat utan att anmäla – skolan väljs sedan vid incheckningen).
 */
export async function enrollStudent(
  sessionId: number,
  studentId: number,
  opts: { sendConfirmation: boolean; bookedByRole: 'admin' | 'instructor'; seats: 'public' | 'physical' },
): Promise<{ error: string; status: number } | { bookingId: number }> {
  const [session, student] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId }, include: { course: true, school: true } }),
    prisma.student.findUnique({ where: { id: studentId } }),
  ]);
  if (!session) return { error: 'Kursen hittades inte', status: 404 };
  if (!student) return { error: 'Eleven hittades inte', status: 404 };
  if (session.status === 'canceled') return { error: 'Kursen är inställd', status: 400 };

  let pnr: string | null = null;
  try { pnr = decryptPersonnummer(student.personnummerEnc); } catch { /* nyckel saknas */ }
  const personnummer = pnr ? formatPersonnummer(pnr) : null;

  const duplicate = await prisma.booking.findFirst({
    where: {
      sessionId,
      status: { not: 'Canceled' },
      OR: [{ studentId: student.id }, ...(pnr ? [{ personnummer: { in: [pnr, personnummer!] } }] : [])],
    },
  });
  if (duplicate) return { error: 'Eleven är redan anmäld till kursen', status: 409 };

  if (opts.seats === 'public') {
    await recalcSeats(sessionId);
    const fresh = await prisma.session.findUnique({ where: { id: sessionId }, select: { seatsAvailable: true } });
    if (!fresh || fresh.seatsAvailable <= 0) return { error: 'Inga lediga platser – öka antalet platser först', status: 409 };
  } else {
    const taken = await prisma.booking.count({ where: { sessionId, status: { not: 'Canceled' } } });
    if (taken >= session.seatLimit) return { error: `Kursen är full (${session.seatLimit} platser) – kontakta kontoret`, status: 409 };
  }

  const name = `${student.firstName} ${student.lastName}`.trim();
  const booking = await prisma.booking.create({
    data: {
      sessionId,
      studentId: student.id,
      guestName: name,
      personnummer,
      guestPhone: student.phone || null,
      guestEmail: student.email || null,
      status: 'Confirmed',
      bookedByRole: opts.bookedByRole,
    },
  });
  await recalcSeats(sessionId);

  if (opts.sendConfirmation && student.email) {
    await sendBookingConfirmationEmail({
      recipientEmail: student.email,
      recipientName: name,
      bookingId: booking.id,
      ...courseEmailInfo(session),
      personnummer: personnummer ?? '',
      phone: student.phone || null,
      customMessage: session.receiptMessage || session.course.receiptMessage || '',
    }).catch(err => console.error('[Anmälan] Bekräftelse misslyckades:', err));
  }
  return { bookingId: booking.id };
}
