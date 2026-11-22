export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { abandonStripeBooking, completeStripePayment, intentForBooking, stripeConfigured } from '@/lib/stripe';

/**
 * Kunden är tillbaka i kassan (direkt efter kortet, eller efter Klarna/3-D Secure).
 * Kontrollerar betalningen hos Stripe – lita aldrig på webbläsaren. Body: { bookingId, paymentIntentId }
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Kortbetalning är inte aktiverad' }, { status: 503 });
  const { bookingId, paymentIntentId } = await request.json().catch(() => ({}));
  const id = Number(bookingId);
  if (!id || typeof paymentIntentId !== 'string') return NextResponse.json({ error: 'Uppgifter saknas' }, { status: 400 });

  const pi = await intentForBooking(paymentIntentId, id).catch(() => null);
  if (!pi) return NextResponse.json({ error: 'Betalningen hittades inte' }, { status: 404 });

  if (pi.status === 'succeeded') {
    const r = await completeStripePayment(pi);
    return r === 'refunded'
      ? NextResponse.json({ status: 'failed', error: 'Platsen hann släppas – pengarna betalas tillbaka. Försök boka igen.' })
      : NextResponse.json({ status: 'paid', amount: pi.amount / 100 });
  }
  // Klarna kan ta en liten stund – kassan frågar igen
  if (pi.status === 'processing') return NextResponse.json({ status: 'processing' });

  await abandonStripeBooking(id, pi.id);
  return NextResponse.json({ status: 'failed', error: 'Betalningen gick inte igenom. Försök igen eller välj ett annat betalsätt.' });
}
