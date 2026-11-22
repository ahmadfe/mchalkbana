export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOwner } from '@/lib/auth';

/**
 * Betalningar för en period (betalningsdatum): elevernas betalningar, skolelever som betalat en del själva
 * och betalda skolfakturor. ?from=ISO&to=ISO. Bara ägaren.
 */

/** Gamla rader har olika stavning ("Swish"/"swish", "Kontant"/"cash") */
const methodOf = (provider: string) => {
  const p = provider.toLowerCase();
  return p === 'kontant' ? 'cash' : p === 'kort' ? 'card' : p;
};

export async function GET(request: Request) {
  if (!(await requireOwner(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get('from') ?? '');
  const to = new Date(url.searchParams.get('to') ?? '');
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return NextResponse.json({ error: 'Ogiltig period' }, { status: 400 });

  const session = { select: { id: true, startTime: true, endTime: true, course: { select: { titleSv: true, behorighet: true } } } };
  const [payments, credits, invoices] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true, guestName: true, personnummer: true, guestPhone: true, guestEmail: true, studentId: true,
            bookedBySchoolUser: { select: { name: true } },
            coupon: { select: { code: true } },
            user: { select: { name: true, email: true, phone: true } },
            session,
          },
        },
      },
    }),
    prisma.schoolCredit.findMany({
      where: { createdAt: { gte: from, lt: to }, restOfId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        schoolUser: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
        booking: { select: { id: true, guestName: true, personnummer: true, studentId: true, session } },
      },
    }),
    prisma.invoice.findMany({
      where: { paidAt: { gte: from, lt: to }, status: 'paid', creditOfId: null },
      orderBy: { paidAt: 'desc' },
      select: { id: true, number: true, period: true, total: true, paidAt: true, buyerName: true, schoolUserId: true, _count: { select: { bookings: true } } },
    }),
  ]);

  const slot = (s: { id: number; startTime: Date; endTime: Date; course: { titleSv: string; behorighet: string } } | null | undefined) =>
    s ? { id: s.id, startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString(), course: s.course.titleSv.trim(), behorighet: s.course.behorighet } : null;

  const rows = [
    ...payments.map(p => ({
      key: `p${p.id}`,
      kind: 'payment' as const,
      id: p.id,
      date: p.createdAt.toISOString(),
      amount: p.amount,
      method: methodOf(p.provider),
      status: p.status,
      note: p.note,
      transactionId: p.transactionId,
      // Bokningsnumret – samma som referensen på bankutdraget ("Tilda-Julin-436" / "436")
      bookingId: p.booking.id,
      name: p.booking.guestName || p.booking.user?.name || '–',
      personnummer: p.booking.personnummer,
      contact: [p.booking.guestPhone || p.booking.user?.phone, p.booking.guestEmail || p.booking.user?.email].filter(Boolean).join(' · '),
      studentId: p.booking.studentId,
      school: p.booking.bookedBySchoolUser?.name ?? null,
      coupon: p.booking.coupon?.code ?? null,
      slot: slot(p.booking.session),
    })),
    ...credits.map(c => ({
      key: `c${c.id}`,
      kind: 'credit' as const,
      id: c.id,
      date: c.createdAt.toISOString(),
      // Om resten delats av till nästa faktura räknas hela beloppet som kom in
      amount: c.amount,
      method: c.method || 'other',
      status: 'Succeeded',
      note: c.note,
      name: c.booking ? c.booking.guestName || c.booking.personnummer || '–' : 'Tillgodo',
      personnummer: c.booking?.personnummer ?? null,
      bookingId: c.booking?.id ?? null,
      studentId: c.booking?.studentId ?? null,
      school: c.schoolUser.name,
      schoolId: c.schoolUser.id,
      invoice: c.invoice,
      slot: slot(c.booking?.session),
    })),
    ...invoices.map(i => ({
      key: `i${i.id}`,
      kind: 'invoice' as const,
      id: i.id,
      date: i.paidAt!.toISOString(),
      amount: i.total,
      method: 'invoice',
      status: 'Succeeded',
      note: '',
      name: `Faktura #${i.number}`,
      school: i.buyerName,
      schoolId: i.schoolUserId,
      period: i.period,
      students: i._count.bookings,
    })),
  ];

  // Rester som delats av vid fakturering hör till sitt original – lägg till dem på originalets belopp
  // (en rest kan i sin tur ha delats igen – följ kedjan till originalet)
  const rests = await prisma.schoolCredit.findMany({ where: { restOfId: { not: null } }, select: { id: true, restOfId: true, amount: true } });
  const parent = new Map(rests.map(r => [r.id, r.restOfId!]));
  const rootOf = (id: number) => { let x = id; while (parent.has(x)) x = parent.get(x)!; return x; };
  for (const r of rests) {
    const row = rows.find(x => x.kind === 'credit' && x.id === rootOf(r.id));
    if (row) row.amount += r.amount;
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({ rows });
}

/** Anteckning på en betalning, ett skolsaldo eller en obetald bokning: { kind: 'payment' | 'credit' | 'booking', id, note } */
export async function PATCH(request: Request) {
  if (!(await requireOwner(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { kind, id, note } = await request.json();
  const text = typeof note === 'string' ? note.trim().slice(0, 300) : '';
  if (kind === 'payment') await prisma.payment.update({ where: { id: Number(id) }, data: { note: text } });
  else if (kind === 'credit') await prisma.schoolCredit.update({ where: { id: Number(id) }, data: { note: text } });
  // Obetald elev – anteckningen sparas på bokningen
  else if (kind === 'booking') await prisma.booking.update({ where: { id: Number(id) }, data: { payNote: text } });
  else return NextResponse.json({ error: 'Okänd typ' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
