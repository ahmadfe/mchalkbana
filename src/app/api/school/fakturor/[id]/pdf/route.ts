export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSchool } from '@/lib/auth';
import { invoicePdf } from '@/lib/invoices';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await requireSchool(request);
  if (!user) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  // Bara skolans egna, skickade fakturor
  const invoice = await prisma.invoice.findFirst({
    where: { id: Number(params.id), schoolUserId: user.userId, status: { not: 'created' } },
    select: { id: true },
  });
  if (!invoice) return NextResponse.json({ error: 'Fakturan hittades inte' }, { status: 404 });
  const file = await invoicePdf(invoice.id);
  if (!file) return NextResponse.json({ error: 'Fakturan hittades inte' }, { status: 404 });
  return new NextResponse(Buffer.from(file.pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${file.filename}"` },
  });
}
