export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { abandonStripeBooking, intentForBooking, stripeConfigured } from '@/lib/stripe';

/** Kortet nekades eller kunden avbröt i kassan: släpp platsen. Body: { bookingId, paymentIntentId } */
export async function POST(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ ok: true });
  const { bookingId, paymentIntentId } = await request.json().catch(() => ({}));
  const id = Number(bookingId);
  if (!id || typeof paymentIntentId !== 'string') return NextResponse.json({ error: 'Uppgifter saknas' }, { status: 400 });
  // Bara den som har betalningens id (kassan) kan släppa bokningen
  const pi = await intentForBooking(paymentIntentId, id).catch(() => null);
  if (!pi) return NextResponse.json({ error: 'Betalningen hittades inte' }, { status: 404 });
  await abandonStripeBooking(id, pi.id);
  return NextResponse.json({ ok: true });
}
