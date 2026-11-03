export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { klarnaConfigured } from '@/lib/klarna';
import { settleKlarnaPayments } from '@/lib/klarnaSettle';

/** Kör Klarna-dragningar nu (samma som nattens körning) */
export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  if (!klarnaConfigured()) return NextResponse.json({ error: 'Klarna är inte konfigurerat' }, { status: 503 });
  return NextResponse.json(await settleKlarnaPayments());
}
