export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { courseEmailInfo, recalcSeats } from '@/lib/kurser';
import { decryptPersonnummer, formatPersonnummer } from '@/lib/personnummer';
import { sendBookingConfirmationEmail } from '@/lib/email';

/** Anmäler en elev ur elevregistret till kursen. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const sessionId = Number(params.id);
  const { studentId, sendConfirmation } = await request.json();

  const [session, student] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId }, include: { course: true, school: true } }),
    prisma.student.findUnique({ where: { id: Number(studentId) } }),
  ]);
  if (!session) return NextResponse.json({ error: 'Kursen hittades inte' }, { status: 404 });
  if (!student) return NextResponse.json({ error: 'Eleven hittades inte' }, { status: 404 });
  if (session.status === 'canceled') return NextResponse.json({ error: 'Kursen är inställd' }, { status: 400 });

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
  if (duplicate) return NextResponse.json({ error: 'Eleven är redan anmäld till kursen' }, { status: 409 });

  // Admin-anmälningar tar publika platser (skolornas kvoter lämnas orörda)
  await recalcSeats(sessionId);
  const fresh = await prisma.session.findUnique({ where: { id: sessionId }, select: { seatsAvailable: true } });
  if (!fresh || fresh.seatsAvailable <= 0) {
    return NextResponse.json({ error: 'Inga lediga platser – öka antalet platser först' }, { status: 409 });
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
      bookedByRole: 'admin',
    },
  });
  await recalcSeats(sessionId);

  if (sendConfirmation && student.email) {
    await sendBookingConfirmationEmail({
      recipientEmail: student.email,
      recipientName: name,
      bookingId: booking.id,
      ...courseEmailInfo(session),
      personnummer: personnummer ?? '',
      phone: student.phone || null,
      customMessage: session.receiptMessage || session.course.receiptMessage || '',
    }).catch(err => console.error('[Kurs anmälan] Bekräftelse misslyckades:', err));
  }

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
