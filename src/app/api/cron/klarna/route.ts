export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextResponse } from 'next/server';
import { klarnaConfigured } from '@/lib/klarna';
import { settleKlarnaPayments } from '@/lib/klarnaSettle';

/** Vercel Cron (se vercel.json) – skickar "Authorization: Bearer <CRON_SECRET>" */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 401 });
  }
  if (!klarnaConfigured()) return NextResponse.json({ skipped: 'Klarna är inte konfigurerat' });
  const result = await settleKlarnaPayments();
  console.log('[Cron] Klarna', JSON.stringify(result));
  return NextResponse.json(result);
}
