export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getDrafts } from '@/lib/invoices';

/** Alla trafikskolor med kommande kurser, elever denna månad och fakturaläget. */
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const now = new Date();
  const [y, m] = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }).split('-').map(Number);
  // Månadens gränser med marginal för svensk tid – räcker för en översikt
  const monthFrom = new Date(Date.UTC(y, m - 1, 1) - 2 * 3600_000);
  const monthTo = new Date(Date.UTC(y, m, 1) - 2 * 3600_000);

  const [schools, drafts] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'school', hidden: false },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, email: true, phone: true,
        schoolAllocations: { where: { session: { startTime: { gt: now }, status: { not: 'canceled' } } }, select: { sessionId: true } },
        assignedSessions: { where: { startTime: { gt: now }, status: { not: 'canceled' } }, select: { id: true } },
        schoolBookings: {
          where: { status: { not: 'Canceled' }, session: { status: { not: 'canceled' }, OR: [{ startTime: { gt: now } }, { startTime: { gte: monthFrom, lt: monthTo } }] } },
          select: { sessionId: true, session: { select: { startTime: true } } },
        },
        invoices: { where: { creditOfId: null, status: { in: ['created', 'sent'] } }, select: { status: true, dueDate: true } },
      },
    }),
    getDrafts(),
  ]);

  return NextResponse.json({
    schools: schools.map(s => {
      const upcoming = new Set([
        ...s.schoolAllocations.map(a => a.sessionId),
        ...s.assignedSessions.map(x => x.id),
        ...s.schoolBookings.filter(b => b.session.startTime > now).map(b => b.sessionId),
      ]);
      return {
        id: s.id, name: s.name, email: s.email, phone: s.phone,
        upcomingCourses: upcoming.size,
        studentsThisMonth: s.schoolBookings.filter(b => b.session.startTime >= monthFrom && b.session.startTime < monthTo).length,
        invoicesToSend: drafts.filter(d => d.schoolUserId === s.id).length + s.invoices.filter(i => i.status === 'created').length,
        invoicesUnpaid: s.invoices.filter(i => i.status === 'sent').length,
        invoicesOverdue: s.invoices.filter(i => i.status === 'sent' && i.dueDate < now).length,
      };
    }),
  });
}
