export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getCompany, parseCompany, saveCompany } from '@/lib/invoices';

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  return NextResponse.json({ company: await getCompany() });
}

export async function PUT(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const parsed = parseCompany(await request.json());
  if ('error' in parsed) return NextResponse.json(parsed, { status: 400 });
  await saveCompany(parsed.data);
  return NextResponse.json({ company: parsed.data });
}
