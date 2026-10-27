export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { isOwner } from '@/lib/owner';
import { getDrafts } from '@/lib/invoices';

type Period = 'today' | 'week' | 'month' | 'year';

// ── Svensk tid: periodgränser räknas i Europe/Stockholm ──
const TZ = 'Europe/Stockholm';
function localParts(d: Date) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d);
  const get = (t: string) => p.find(x => x.type === t)!.value;
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) };
}
/** Midnatt i Stockholm för ett datum (y, m 1–12, d) */
function midnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d);
  const shown = new Date(new Date(guess).toLocaleString('en-US', { timeZone: TZ }));
  const offset = shown.getTime() - new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  return new Date(guess - offset);
}
function periodRange(period: Period, now: Date): { from: Date; to: Date } {
  const { y, m, d, wd } = localParts(now);
  switch (period) {
    case 'today': return { from: midnight(y, m, d), to: midnight(y, m, d + 1) };
    case 'week': return { from: midnight(y, m, d - wd), to: midnight(y, m, d - wd + 7) };
    case 'month': return { from: midnight(y, m, 1), to: midnight(y, m + 1, 1) };
    case 'year': return { from: midnight(y, 1, 1), to: midnight(y + 1, 1, 1) };
  }
}
const monthKey = (d: Date) => { const { y, m } = localParts(d); return `${y}-${String(m).padStart(2, '0')}`; };

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const owner = isOwner(user);

  const url = new URL(request.url);
  const period = (['today', 'week', 'month', 'year'].includes(url.searchParams.get('period') ?? '') ? url.searchParams.get('period') : 'month') as Period;
  const now = new Date();
  const range = periodRange(period, now);
  const today = periodRange('today', now);
  const month = periodRange('month', now);
  const in7 = new Date(now.getTime() + 7 * 86400_000);
  const in14 = new Date(now.getTime() + 14 * 86400_000);
  const in3 = new Date(now.getTime() + 3 * 86400_000);

  const activeBookings = { where: { status: { not: 'Canceled' } } } as const;
  const sessionCard = {
    id: true, startTime: true, endTime: true, seatLimit: true,
    course: { select: { titleSv: true, type: true } },
    assignedSchoolUsers: { where: { role: 'instructor' }, select: { name: true } },
  } as const;

  const [
    periodSessions, bookingsCount, todaySessions, nextSessions, noInstructor, unpaidBookings,
    unreported, closingReservations, overdue, createdInvoices, schoolBookings, drafts,
  ] = await Promise.all([
    prisma.session.findMany({
      where: { startTime: { gte: range.from, lt: range.to }, status: { not: 'canceled' } },
      select: { seatLimit: true, _count: { select: { bookings: activeBookings } } },
    }),
    prisma.booking.count({ where: { bookingTime: { gte: range.from, lt: range.to }, status: { not: 'Canceled' } } }),
    prisma.session.findMany({
      where: { startTime: { gte: today.from, lt: today.to }, status: { not: 'canceled' } },
      select: { ...sessionCard, bookings: { where: { status: { not: 'Canceled' } }, select: { checkedInAt: true } } },
      orderBy: { startTime: 'asc' },
    }),
    prisma.session.findMany({
      where: { startTime: { gte: today.to, lt: in7 }, status: { not: 'canceled' } },
      select: { ...sessionCard, _count: { select: { bookings: activeBookings } } },
      orderBy: { startTime: 'asc' },
    }),
    prisma.session.count({
      where: { startTime: { gte: now, lt: in14 }, status: { not: 'canceled' }, assignedSchoolUsers: { none: { role: 'instructor' } } },
    }),
    // Samma regel som kurslistan: privata bokningar utan betalning på kommande kurser
    prisma.booking.count({
      where: { status: { notIn: ['Canceled', 'Paid'] }, bookedBySchoolUserId: null, payment: { is: null }, session: { startTime: { gte: today.from }, status: { not: 'canceled' } } },
    }),
    prisma.session.count({ where: { endTime: { lt: now }, reportToTS: true, reportedAt: null, status: { not: 'canceled' } } }),
    prisma.sessionSchoolAllocation.findMany({
      where: { releasedAt: null, fillBy: { gte: now, lt: in3 } },
      select: { sessionId: true, allocatedSeats: true, schoolUserId: true, session: { select: { bookings: { where: { status: { not: 'Canceled' } }, select: { bookedBySchoolUserId: true } } } } },
    }),
    prisma.invoice.count({ where: { status: 'sent', creditOfId: null, dueDate: { lt: now } } }),
    prisma.invoice.count({ where: { status: 'created' } }),
    prisma.booking.findMany({
      where: { bookedBySchoolUserId: { not: null }, status: { not: 'Canceled' }, session: { startTime: { gte: month.from, lt: month.to }, status: { not: 'canceled' } } },
      select: { bookedBySchoolUser: { select: { id: true, name: true } } },
    }),
    getDrafts(),
  ]);

  const seats = periodSessions.reduce((s, x) => s + x.seatLimit, 0);
  const booked = periodSessions.reduce((s, x) => s + x._count.bookings, 0);
  const closing = closingReservations.filter(a => a.session.bookings.filter(b => b.bookedBySchoolUserId === a.schoolUserId).length < a.allocatedSeats);

  const schools = new Map<number, { name: string; students: number }>();
  for (const b of schoolBookings) {
    const s = b.bookedBySchoolUser!;
    schools.set(s.id, { name: s.name, students: (schools.get(s.id)?.students ?? 0) + 1 });
  }

  const card = (s: (typeof nextSessions)[number] | (typeof todaySessions)[number]) => ({
    id: s.id, title: s.course.titleSv, type: s.course.type,
    startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString(),
    seatLimit: s.seatLimit, instructors: s.assignedSchoolUsers.map(u => u.name),
  });

  const todo = [
    { key: 'noInstructor', label: 'Kurser utan lärare (14 dagar)', count: noInstructor, href: '/admin/kurser' },
    { key: 'unpaid', label: 'Obetalda bokningar', count: unpaidBookings, href: '/admin/kurser' },
    { key: 'closing', label: 'Skolreservationer som stänger inom 3 dagar', count: closing.length, href: closing.length === 1 ? `/admin/kurser/${closing[0].sessionId}` : '/admin/kurser' },
    { key: 'invoices', label: 'Fakturor att skicka', count: drafts.length + createdInvoices, href: '/admin/fakturor' },
    { key: 'overdue', label: 'Förfallna fakturor', count: overdue, href: '/admin/fakturor' },
    { key: 'unreported', label: 'Kurser att rapportera till Transportstyrelsen', count: unreported, href: '/admin/tillsyn' },
  ];

  // ── Intäkter: bara ägaren ──
  let income: null | { period: { swish: number; schools: number }; months: { month: string; swish: number; schools: number }[] } = null;
  if (owner) {
    const { y, m } = localParts(now);
    const yearAgo = midnight(y, m - 11, 1);
    const [payments, invoices] = await Promise.all([
      prisma.payment.findMany({ where: { status: 'Succeeded', createdAt: { gte: yearAgo } }, select: { amount: true, createdAt: true } }),
      prisma.invoice.findMany({ where: { status: { not: 'created' }, issueDate: { gte: yearAgo } }, select: { total: true, issueDate: true } }),
    ]);
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = midnight(y, m - 11 + i, 15);
      return { month: monthKey(d), swish: 0, schools: 0 };
    });
    const byKey = new Map(months.map(x => [x.month, x]));
    for (const p of payments) { const r = byKey.get(monthKey(p.createdAt)); if (r) r.swish += p.amount; }
    for (const i of invoices) { const r = byKey.get(monthKey(i.issueDate)); if (r) r.schools += i.total; }
    const inRange = (d: Date) => d >= range.from && d < range.to;
    income = {
      period: {
        swish: payments.filter(p => inRange(p.createdAt)).reduce((s, p) => s + p.amount, 0),
        schools: invoices.filter(i => inRange(i.issueDate)).reduce((s, i) => s + i.total, 0),
      },
      months,
    };
  }

  return NextResponse.json({
    period,
    cards: { courses: periodSessions.length, bookings: bookingsCount, booked, seats },
    today: todaySessions.map(s => ({ ...card(s), booked: s.bookings.length, checkedIn: s.bookings.filter(b => b.checkedInAt).length })),
    next7: nextSessions.map(s => ({ ...card(s), booked: s._count.bookings })),
    todo,
    schools: Array.from(schools.values()).sort((a, b) => b.students - a.students),
    income,
  });
}
