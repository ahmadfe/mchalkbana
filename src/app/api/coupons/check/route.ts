export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { checkCoupon } from '@/lib/coupons';

/** Kassan: { code, sessionId } → nytt pris. Koden kontrolleras igen när betalningen startar. */
export async function POST(request: Request) {
  const { code, sessionId } = await request.json().catch(() => ({}));
  if (!code || !sessionId) return NextResponse.json({ error: 'Skriv en rabattkod' }, { status: 400 });
  const result = await checkCoupon(String(code), Number(sessionId));
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ code: result.code, label: result.label, price: result.price, normalPrice: result.normalPrice, discount: result.discount });
}
