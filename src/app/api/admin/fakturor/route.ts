export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { createInvoice, getCompany, getDrafts, invoiceStats, missingCompanyFields } from '@/lib/invoices';

/** Allt till fakturasidan: utkast att skicka, fakturor och siffrorna överst. */
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const [company, drafts, invoices] = await Promise.all([
    getCompany(),
    getDrafts(),
    prisma.invoice.findMany({
      orderBy: { number: 'desc' },
      select: {
        id: true, number: true, period: true, status: true, issueDate: true, dueDate: true, total: true,
        buyerName: true, sentAt: true, paidAt: true, creditOfId: true, _count: { select: { bookings: true } },
      },
    }),
  ]);
  return NextResponse.json({
    company,
    missing: missingCompanyFields(company),
    drafts,
    invoices: invoices.map(({ _count, ...i }) => ({ ...i, students: _count.bookings })),
    stats: await invoiceStats(drafts),
  });
}

/** Skapar fakturan för en skola och månad. */
export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { schoolUserId, period } = await request.json();
  if (!schoolUserId || !/^\d{4}-\d{2}$/.test(String(period))) return NextResponse.json({ error: 'Välj skola och månad' }, { status: 400 });
  const result = await createInvoice(Number(schoolUserId), String(period));
  return 'error' in result ? NextResponse.json(result, { status: 400 }) : NextResponse.json(result, { status: 201 });
}
