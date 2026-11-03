export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createSession, klarnaConfigured, KlarnaError } from '@/lib/klarna';
import { checkoutOrder } from '@/lib/checkoutKlarna';

/** Kassan: { sessionId, couponCode? } → Klarna-session för widgeten. Ingen bokning skapas här. */
export async function POST(request: Request) {
  if (!klarnaConfigured()) return NextResponse.json({ error: 'Klarna är inte aktiverat' }, { status: 503 });
  const { sessionId, couponCode } = await request.json().catch(() => ({}));
  const result = await checkoutOrder(Number(sessionId), couponCode || null);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  try {
    const s = await createSession(result.order);
    return NextResponse.json({
      clientToken: s.client_token,
      amount: result.order.amount,
      categories: s.payment_method_categories.map(c => ({ id: c.identifier, name: c.name, logo: c.asset_urls?.standard ?? null })),
    });
  } catch (e) {
    if (e instanceof KlarnaError) return NextResponse.json({ error: 'Klarna kunde inte startas just nu – välj Swish eller försök igen' }, { status: 502 });
    throw e;
  }
}
