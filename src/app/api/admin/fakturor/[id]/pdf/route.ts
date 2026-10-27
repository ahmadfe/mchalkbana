export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { invoicePdf } from '@/lib/invoices';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const file = await invoicePdf(Number(params.id));
  if (!file) return NextResponse.json({ error: 'Fakturan hittades inte' }, { status: 404 });
  const download = new URL(request.url).searchParams.has('download');
  return new NextResponse(Buffer.from(file.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${file.filename}"`,
    },
  });
}
