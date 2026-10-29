export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { deleteAccount, updateAccount } from '@/lib/personal';

/** { name, email, phone } | { resetPassword: true } | { disabled: boolean } */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const me = await requireAdmin(request);
  if (!me) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const result = await updateAccount(me, Number(params.id), await request.json());
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const me = await requireAdmin(request);
  if (!me) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const result = await deleteAccount(me, Number(params.id));
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
