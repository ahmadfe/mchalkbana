export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { expectedPrice } from '@/lib/kurser';
import { completePaidBooking } from '@/lib/payments';
import { bookingIdFromReference, createPaymentRequest, getPaymentRequest, swishFriendlyError } from '@/lib/swish';

/**
 * Telefonbokning: admin skickar en Swish-förfrågan till elevens telefon.
 * Eleven godkänner i Swish-appen → callbacken (eller GET nedan) markerar bokningen som betald.
 * Bokningen avbokas INTE om eleven nekar – admin har bokat den.
 */
export async function POST(request: Request, { params }: { params: { bookingId: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.bookingId);
  const { phone, amount: custom } = await request.json().catch(() => ({}));

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { payment: { select: { id: true } }, user: { select: { name: true } }, session: { include: { course: true } } },
  });
  if (!booking || booking.status === 'Canceled') return NextResponse.json({ error: 'Bokningen hittades inte' }, { status: 404 });
  if (booking.payment) return NextResponse.json({ error: 'Eleven har redan en betalning registrerad' }, { status: 400 });
  if (booking.bookedBySchoolUserId) return NextResponse.json({ error: 'Eleven faktureras en trafikskola' }, { status: 400 });
  if (booking.session.status === 'canceled') return NextResponse.json({ error: 'Kursen är inställd' }, { status: 400 });
  const payerPhone = String(phone ?? booking.guestPhone ?? '').trim();
  if (payerPhone.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'Ange elevens Swish-nummer' }, { status: 400 });

  // Eget belopp från admin, annars elevens pris
  const normal = expectedPrice({ ...booking, payment: null }, booking.session, null);
  const amount = custom === undefined || custom === null || custom === '' ? normal : Number(custom);
  if (!Number.isInteger(amount) || amount < 1 || amount > 50000) {
    return NextResponse.json({ error: amount === 0 ? 'Priset är 0 kr – registrera som Gratis i stället' : 'Beloppet ska vara hela kronor (1–50 000)' }, { status: 400 });
  }
  // Ett ändrat belopp blir elevens pris (som "Ändra pris") – så pris, förfrågan och betalning stämmer
  await prisma.booking.update({ where: { id }, data: { price: amount, ...(amount !== normal ? { priceOverride: amount } : {}) } });

  try {
    const { swishRequestId } = await createPaymentRequest({
      bookingId: id,
      name: booking.guestName || booking.user?.name,
      amount,
      payerPhone,
      message: `Uppsala Halkbana – ${booking.session.course.titleSv}`,
    });
    return NextResponse.json({ swishRequestId, amount });
  } catch (err) {
    console.error('[Swish] admin request error:', err);
    return NextResponse.json({ error: swishFriendlyError(err) }, { status: 500 });
  }
}

/** Status för förfrågan: ?id=<swishRequestId>. Betald → bokningen markeras direkt (om callbacken dröjer). */
export async function GET(request: Request, { params }: { params: { bookingId: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.bookingId);
  const swishId = new URL(request.url).searchParams.get('id');
  if (!swishId) return NextResponse.json({ error: 'id saknas' }, { status: 400 });
  try {
    const s = await getPaymentRequest(swishId);
    // Förfrågan måste höra till just den här bokningen
    if (s.payeePaymentReference && bookingIdFromReference(s.payeePaymentReference) !== id) {
      return NextResponse.json({ error: 'Fel bokning' }, { status: 400 });
    }
    if (s.status === 'PAID') await completePaidBooking(id, { provider: 'Swish', transactionId: s.paymentReference ?? `swish_${swishId}` });
    return NextResponse.json({ status: s.status, errorMessage: s.errorMessage ?? null });
  } catch (err) {
    console.error('[Swish] admin status error:', err);
    return NextResponse.json({ status: 'UNKNOWN' });
  }
}
