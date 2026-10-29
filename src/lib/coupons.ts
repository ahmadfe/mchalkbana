import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/*
 * Rabattkoder. Varje kod kan användas en gång. En kod räknas som använd när bokningen är betald
 * (eller bekräftad med en 100 %-kod). Under en pågående Swish-betalning är koden reserverad en stund,
 * så att två personer inte kan använda samma kod samtidigt. Avbryts betalningen blir koden ledig igen.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // utan 0/O, 1/I/L
const PREFIX = 'UH';
const RESERVE_MINUTES = 15;
const USED_STATUSES = ['Paid', 'Confirmed'];

type Db = Prisma.TransactionClient | typeof prisma;

export type CouponKind = 'percent' | 'amount';

/** "uh-7k3p qx9m" → "UH7K3PQX9M" */
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');
/** "UH7K3PQX9M" → "UH-7K3P-QX9M" */
export const formatCode = (code: string) => code.length === 10 ? `${code.slice(0, 2)}-${code.slice(2, 6)}-${code.slice(6)}` : code;

export const discountLabel = (kind: string, value: number) => kind === 'percent' ? `${value} %` : `${value.toLocaleString('sv-SE')} kr`;

/** Nya unika koder som inte redan finns i databasen */
export async function generateCodes(count: number): Promise<string[]> {
  const codes = new Set<string>();
  while (codes.size < count) {
    const batch = new Set<string>();
    while (batch.size < count - codes.size) {
      let c = PREFIX;
      for (let i = 0; i < 8; i++) c += ALPHABET[crypto.randomInt(ALPHABET.length)];
      if (!codes.has(c)) batch.add(c);
    }
    const taken = new Set((await prisma.coupon.findMany({ where: { code: { in: Array.from(batch) } }, select: { code: true } })).map(c => c.code));
    batch.forEach(c => { if (!taken.has(c)) codes.add(c); });
  }
  return Array.from(codes);
}

/** Status för en kod utifrån dess bokningar */
export function couponState(
  coupon: { disabled: boolean; batch: { validTo: Date | null } },
  bookings: { status: string; bookingTime: Date }[],
  now = new Date(),
): 'used' | 'reserved' | 'disabled' | 'expired' | 'unused' {
  if (bookings.some(b => USED_STATUSES.includes(b.status))) return 'used';
  if (coupon.disabled) return 'disabled';
  if (coupon.batch.validTo && coupon.batch.validTo <= now) return 'expired';
  if (bookings.some(b => b.status === 'Pending' && b.bookingTime.getTime() > now.getTime() - RESERVE_MINUTES * 60_000)) return 'reserved';
  return 'unused';
}

export interface CouponPrice {
  couponId: number;
  code: string;
  label: string;
  /** Vad eleven betalar med koden */
  price: number;
  /** Vad eleven annars hade betalat (rea eller ordinarie) */
  normalPrice: number;
  discount: number;
}

/**
 * Kontrollerar en kod mot ett kurstillfälle och räknar ut priset.
 * Koden dras från ordinarie pris; har kursen ett billigare reapris gäller rean och koden används inte.
 * `bookingId` = bokningen som ska använda koden (räknas inte som "upptagen").
 */
export async function checkCoupon(input: string, sessionId: number, bookingId?: number, db: Db = prisma): Promise<CouponPrice | { error: string }> {
  const code = normalizeCode(input);
  if (!code) return { error: 'Skriv en rabattkod' };
  const coupon = await db.coupon.findUnique({
    where: { code },
    include: {
      batch: true,
      bookings: { where: { status: { not: 'Canceled' }, ...(bookingId ? { id: { not: bookingId } } : {}) }, select: { status: true, bookingTime: true } },
    },
  });
  if (!coupon) return { error: 'Koden finns inte – kontrollera stavningen' };

  const state = couponState(coupon, coupon.bookings);
  if (state === 'used') return { error: 'Koden är redan använd' };
  if (state === 'disabled') return { error: 'Koden gäller inte längre' };
  if (state === 'expired') return { error: 'Koden har gått ut' };
  if (state === 'reserved') return { error: 'Koden används just nu i en annan bokning – försök igen om en stund' };

  const session = await db.session.findUnique({ where: { id: sessionId }, select: { courseId: true, discountPrice: true, course: { select: { price: true } } } });
  if (!session) return { error: 'Kursen hittades inte' };
  if (coupon.batch.courseIds.length > 0 && !coupon.batch.courseIds.includes(session.courseId)) return { error: 'Koden gäller inte den här kursen' };

  const list = session.course.price;
  const normalPrice = session.discountPrice ?? list;
  const withCode = coupon.batch.kind === 'percent'
    ? Math.round(list * (100 - coupon.batch.value) / 100)
    : Math.max(0, list - coupon.batch.value);
  if (withCode >= normalPrice) return { error: 'Kursen har redan ett lägre pris än rabattkoden ger – koden behövs inte' };

  return {
    couponId: coupon.id,
    code: formatCode(coupon.code),
    label: discountLabel(coupon.batch.kind, coupon.batch.value),
    price: withCode,
    normalPrice,
    discount: normalPrice - withCode,
  };
}

/**
 * Knyter koden till bokningen och sparar priset. Koden låses under kontrollen så att
 * två samtidiga betalningar inte kan använda samma kod.
 */
export async function attachCoupon(bookingId: number, sessionId: number, input: string): Promise<CouponPrice | { error: string }> {
  const code = normalizeCode(input);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Coupon" WHERE code = ${code} FOR UPDATE`;
    const result = await checkCoupon(code, sessionId, bookingId, tx);
    if ('error' in result) return result;
    await tx.booking.update({ where: { id: bookingId }, data: { price: result.price, couponId: result.couponId, couponDiscount: result.discount } });
    return result;
  });
}
