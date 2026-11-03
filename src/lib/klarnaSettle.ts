import { prisma } from '@/lib/db';
import { captureOrder, cancelOrder, extendAuthorization, getOrder, KlarnaError } from '@/lib/klarna';

/*
 * Klarna-reservationer: beloppet reserveras vid bokning och dras när kursen är genomförd.
 * Avbokning senast 48 timmar före kursstart släpper reservationen. Senare avbokning och uteblivna
 * elever debiteras (dras efter kursen), enligt bokningsvillkoren.
 */

export const FREE_CANCEL_HOURS = 48;
/** Dra i förväg om reservationen går ut inom så här många dagar och inte kan förlängas */
const EXPIRY_MARGIN_DAYS = 3;

export const hoursUntil = (start: Date) => (start.getTime() - Date.now()) / 3600_000;

const describe = (b: { id: number; session: { startTime: Date; course: { titleSv: string } } }) =>
  `${b.session.course.titleSv.trim()} ${b.session.startTime.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })} (bokning #${b.id})`;

/**
 * Anropas när en bokning avbokas. Klarna: i tid → släpp reservationen; för sent → markera sen avanmälan
 * så att beloppet dras efter kursen. Ger ett kort besked till admin.
 */
export async function klarnaOnCancel(bookingId: number): Promise<string | null> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true, session: { include: { course: true } } } });
  const pay = booking?.payment;
  if (!booking || !pay || pay.provider !== 'Klarna' || pay.status !== 'Authorized' || !pay.transactionId) return null;

  const inTime = hoursUntil(booking.session.startTime) >= FREE_CANCEL_HOURS || booking.session.status === 'canceled';
  if (!inTime) {
    await prisma.booking.update({ where: { id: bookingId }, data: { attendance: 'late_cancel' } });
    return 'Sen avbokning (mindre än 48 timmar kvar) – Klarna-beloppet dras efter kursen enligt villkoren.';
  }
  try {
    await cancelOrder(pay.transactionId);
    await prisma.payment.update({ where: { id: pay.id }, data: { status: 'Canceled' } });
    return 'Klarna-reservationen är släppt – eleven debiteras inget.';
  } catch (e) {
    console.error('[Klarna] Kunde inte släppa reservationen för bokning', bookingId, e);
    return 'Bokningen är avbokad, men Klarna-reservationen kunde inte släppas just nu – den släpps automatiskt i nattens körning.';
  }
}

export interface SettleResult { captured: number[]; released: number[]; extended: number[]; failed: { bookingId: number; error: string }[] }

/**
 * Nattlig körning (och knapp i admin): drar belopp för genomförda kurser, släpper reservationer för
 * avbokningar i tid och förlänger/drar reservationer som snart går ut.
 */
export async function settleKlarnaPayments(): Promise<SettleResult> {
  const result: SettleResult = { captured: [], released: [], extended: [], failed: [] };
  const payments = await prisma.payment.findMany({
    where: { provider: 'Klarna', status: 'Authorized', transactionId: { not: null } },
    include: { booking: { include: { session: { include: { course: true } } } } },
  });
  const now = Date.now();

  for (const pay of payments) {
    const b = pay.booking;
    const orderId = pay.transactionId!;
    try {
      const courseCanceled = b.session.status === 'canceled';
      const freeCancel = b.status === 'Canceled' && b.attendance !== 'late_cancel';
      if (courseCanceled || freeCancel) {
        await cancelOrder(orderId);
        await prisma.payment.update({ where: { id: pay.id }, data: { status: 'Canceled' } });
        result.released.push(b.id);
        continue;
      }

      const courseDone = b.session.endTime.getTime() <= now;
      let capture = courseDone;
      if (!courseDone) {
        // Reservationen räcker inte till kursen: försök förlänga, annars dra nu
        const order = await getOrder(orderId);
        const expires = order.expires_at ? new Date(order.expires_at).getTime() : Infinity;
        if (expires - now < EXPIRY_MARGIN_DAYS * 86400_000 && expires < b.session.endTime.getTime()) {
          try { await extendAuthorization(orderId); result.extended.push(b.id); }
          catch { capture = true; }
        }
      }
      if (capture) {
        const order = await getOrder(orderId);
        if (order.status === 'AUTHORIZED' || order.status === 'PART_CAPTURED') {
          await captureOrder(orderId, order.remaining_authorized_amount / 100, describe(b));
        }
        await prisma.payment.update({ where: { id: pay.id }, data: { status: 'Succeeded' } });
        result.captured.push(b.id);
      }
    } catch (e) {
      result.failed.push({ bookingId: b.id, error: e instanceof KlarnaError ? e.code : String(e) });
      console.error('[Klarna] settle failed for booking', b.id, e);
    }
  }
  return result;
}
