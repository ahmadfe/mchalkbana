export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { CREDIT_METHODS } from '@/lib/schoolCredits';

/** Skolans saldo: alla tillgodon, använda och oanvända. ?schoolUserId= */
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const schoolUserId = Number(new URL(request.url).searchParams.get('schoolUserId'));
  if (!schoolUserId) return NextResponse.json({ error: 'schoolUserId saknas' }, { status: 400 });
  const credits = await prisma.schoolCredit.findMany({
    where: { schoolUserId },
    orderBy: { createdAt: 'desc' },
    include: {
      invoice: { select: { id: true, number: true } },
      booking: { select: { guestName: true, personnummer: true, session: { select: { startTime: true } } } },
    },
  });
  return NextResponse.json({
    balance: credits.filter(c => !c.invoiceId).reduce((s, c) => s + c.amount, 0),
    credits: credits.map(c => ({
      id: c.id,
      amount: c.amount,
      method: c.method,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
      student: c.booking ? c.booking.guestName || c.booking.personnummer || null : null,
      courseDate: c.booking?.session.startTime.toISOString() ?? null,
      invoice: c.invoice,
    })),
  });
}

/**
 * Lägg till på skolans saldo.
 * { schoolUserId, amount, method?, note? } – allmänt tillgodo
 * { bookingId, amount, method } – skoleleven betalade en del själv (skolan hämtas från bokningen)
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const body = await request.json();
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) return NextResponse.json({ error: 'Ange ett belopp i hela kronor' }, { status: 400 });
  const method = typeof body.method === 'string' && (CREDIT_METHODS as readonly string[]).includes(body.method) ? body.method : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';

  let schoolUserId: number;
  let bookingId: number | null = null;
  if (body.bookingId) {
    const booking = await prisma.booking.findUnique({ where: { id: Number(body.bookingId) }, select: { id: true, bookedBySchoolUserId: true, invoiceId: true, status: true } });
    if (!booking) return NextResponse.json({ error: 'Bokningen hittades inte' }, { status: 404 });
    if (!booking.bookedBySchoolUserId) return NextResponse.json({ error: 'Eleven hör inte till någon trafikskola' }, { status: 400 });
    if (booking.status === 'Canceled') return NextResponse.json({ error: 'Bokningen är avbokad' }, { status: 400 });
    if (booking.invoiceId) return NextResponse.json({ error: 'Eleven finns redan på en faktura – lägg in beloppet som tillgodo på skolans sida i stället' }, { status: 400 });
    if (!method) return NextResponse.json({ error: 'Välj hur eleven betalade' }, { status: 400 });
    schoolUserId = booking.bookedBySchoolUserId;
    bookingId = booking.id;
  } else {
    const school = await prisma.user.findFirst({ where: { id: Number(body.schoolUserId), role: 'school' }, select: { id: true } });
    if (!school) return NextResponse.json({ error: 'Trafikskolan hittades inte' }, { status: 404 });
    if (!note) return NextResponse.json({ error: 'Skriv vad beloppet gäller' }, { status: 400 });
    schoolUserId = school.id;
  }

  const credit = await prisma.schoolCredit.create({ data: { schoolUserId, bookingId, amount, method, note, createdById: admin.userId } });
  return NextResponse.json({ id: credit.id });
}

/** Ta bort ett tillgodo som inte har dragits av på någon faktura än. ?id= */
export async function DELETE(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get('id'));
  const credit = await prisma.schoolCredit.findUnique({ where: { id } });
  if (!credit) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 });
  if (credit.invoiceId) return NextResponse.json({ error: 'Beloppet har redan dragits av på en faktura – kreditera fakturan först' }, { status: 400 });
  await prisma.schoolCredit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
