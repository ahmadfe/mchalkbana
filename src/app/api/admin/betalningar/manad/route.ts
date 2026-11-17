export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { expectedPrice } from '@/lib/kurser';
import { periodOf } from '@/lib/invoices';
import { schoolPriceFor } from '@/lib/schoolPrice';

/**
 * Per månad (kursdatum) för ett år: privat betalt, skolornas värde (skolpris, fakturerat eller inte) och obetalt.
 * ?year=2026. Bara ägaren.
 */

const methodOf = (provider: string) => {
  const p = provider.toLowerCase();
  return p === 'kontant' ? 'cash' : p === 'kort' ? 'card' : p;
};

interface SchoolPart { id: number; name: string; count: number; amount: number; studentPaid: number; notInvoiced: number; invoices: { id: number; number: number; status: string }[] }
interface Month {
  period: string;
  private: { amount: number; count: number; byMethod: Record<string, number> };
  school: { amount: number; count: number; notInvoiced: number; schools: SchoolPart[] };
  unpaid: { amount: number; count: number };
}

export async function GET(request: Request) {
  if (!(await requireOwner(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const year = Number(new URL(request.url).searchParams.get('year')) || new Date().getFullYear();
  // Marginal för svensk tid – månaden räknas med periodOf nedan
  const from = new Date(Date.UTC(year, 0, 1) - 2 * 3600_000);
  const to = new Date(Date.UTC(year + 1, 0, 1) + 2 * 3600_000);

  const [bookings, allCourses] = await Promise.all([
    prisma.booking.findMany({
      where: { status: { not: 'Canceled' }, session: { startTime: { gte: from, lt: to }, status: { not: 'canceled' } } },
      select: {
        id: true, price: true, priceOverride: true, comboParts: true, bookedBySchoolUserId: true,
        payment: { select: { amount: true, status: true, provider: true } },
        invoice: { select: { id: true, number: true, status: true } },
        schoolCredits: { where: { restOfId: null }, select: { amount: true } },
        bookedBySchoolUser: { select: { id: true, name: true, schoolCoursePrices: { select: { courseId: true, price: true, part: true } } } },
        session: { select: { startTime: true, discountPrice: true, course: { select: { id: true, price: true, type: true, behorighet: true } } } },
      },
    }),
    prisma.course.findMany({ select: { id: true, type: true, behorighet: true } }),
  ]);

  const months = new Map<string, Month>();
  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${String(m).padStart(2, '0')}`;
    months.set(period, { period, private: { amount: 0, count: 0, byMethod: {} }, school: { amount: 0, count: 0, notInvoiced: 0, schools: [] }, unpaid: { amount: 0, count: 0 } });
  }

  for (const b of bookings) {
    const month = months.get(periodOf(b.session.startTime));
    if (!month) continue;
    const school = b.bookedBySchoolUser;

    if (school) {
      // Samma pris som fakturan: handsatt pris, annars skolans pris, annars ordinarie
      const amount = b.priceOverride ?? schoolPriceFor(school.schoolCoursePrices, b.session.course, b.comboParts, allCourses) ?? b.session.course.price;
      let part = month.school.schools.find(s => s.id === school.id);
      if (!part) { part = { id: school.id, name: school.name, count: 0, amount: 0, studentPaid: 0, notInvoiced: 0, invoices: [] }; month.school.schools.push(part); }
      part.count++;
      part.amount += amount;
      part.studentPaid += b.schoolCredits.reduce((s, c) => s + c.amount, 0);
      if (b.invoice) { if (!part.invoices.some(i => i.id === b.invoice!.id)) part.invoices.push(b.invoice); }
      else { part.notInvoiced++; month.school.notInvoiced++; }
      month.school.count++;
      month.school.amount += amount;
      continue;
    }

    const pay = b.payment;
    if (pay && (pay.status === 'Succeeded' || pay.status === 'Authorized')) {
      const method = methodOf(pay.provider);
      month.private.amount += pay.amount;
      month.private.count++;
      month.private.byMethod[method] = (month.private.byMethod[method] ?? 0) + pay.amount;
    } else if (!pay || pay.status !== 'Refunded') {
      // Obetald: ingen betalning och ingen skola (samma regel som listan Obetalda)
      month.unpaid.amount += expectedPrice({ ...b, payment: null }, b.session, null);
      month.unpaid.count++;
    }
  }

  const list = Array.from(months.values());
  for (const m of list) m.school.schools.sort((a, b) => b.amount - a.amount);
  return NextResponse.json({ year, months: list });
}
