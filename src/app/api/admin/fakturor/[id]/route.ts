export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { updateInvoice, type InvoiceAction } from '@/lib/invoices';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(params.id) },
    include: { lines: { orderBy: { date: 'asc' } } },
  });
  if (!invoice) return NextResponse.json({ error: 'Fakturan hittades inte' }, { status: 404 });
  return NextResponse.json({ invoice: { ...invoice, seller: JSON.parse(invoice.seller) } });
}

const ACTIONS: InvoiceAction[] = ['sent', 'paid', 'unpaid', 'delete'];

/** Status (skickad/betald/ta bort) eller köparens uppgifter. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.id);
  const body = await request.json();

  if (body.action === 'buyer') {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return NextResponse.json({ error: 'Fakturan hittades inte' }, { status: 404 });
    const orgNr = String(body.orgNr ?? '').trim();
    const address = String(body.address ?? '').trim();
    // Sparas på skolan så att nästa faktura får samma uppgifter; en skickad faktura ändras inte
    await prisma.user.update({ where: { id: invoice.schoolUserId }, data: { orgNr, billingAddress: address } });
    if (invoice.status === 'created') {
      await prisma.invoice.update({ where: { id }, data: { buyerOrgNr: orgNr, buyerAddress: address } });
    }
    return NextResponse.json({ ok: true });
  }

  if (!ACTIONS.includes(body.action)) return NextResponse.json({ error: 'Okänd åtgärd' }, { status: 400 });
  const result = await updateInvoice(id, body.action);
  return 'error' in result ? NextResponse.json(result, { status: 400 }) : NextResponse.json(result);
}
