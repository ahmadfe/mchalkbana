export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const body = await request.json();
  const data: { name?: string; address?: string; city?: string; contactEmail?: string; active?: boolean } = {};
  for (const f of ['name', 'address', 'city', 'contactEmail'] as const) {
    if (body[f] !== undefined) data[f] = String(body[f]).trim();
  }
  if (body.active !== undefined) data.active = !!body.active;
  if (data.name === '' || data.address === '') return NextResponse.json({ error: 'Namn och adress krävs' }, { status: 400 });
  const filial = await prisma.school.update({ where: { id: Number(params.id) }, data });
  return NextResponse.json({ filial });
}
