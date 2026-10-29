export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAccount, listAccounts } from '@/lib/personal';

export async function GET(request: Request) {
  const me = await requireAdmin(request);
  if (!me) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  return NextResponse.json({ accounts: await listAccounts(me) });
}

/** Nytt konto: { role, name, email, phone }. Lösenordet skapas automatiskt, mejlas och returneras en gång. */
export async function POST(request: Request) {
  const me = await requireAdmin(request);
  if (!me) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const result = await createAccount(me, await request.json());
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
