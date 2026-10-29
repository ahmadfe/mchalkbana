export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/** { disabled } för en enskild kod */
export async function PATCH(request: Request, { params }: { params: { codeId: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { disabled } = await request.json();
  await prisma.coupon.update({ where: { id: Number(params.codeId) }, data: { disabled: !!disabled } });
  return NextResponse.json({ ok: true });
}
