import { prisma } from '@/lib/db';
import { checkCoupon } from '@/lib/coupons';
import type { KlarnaOrderInput } from '@/lib/klarna';

const SITE = () => process.env.NEXT_PUBLIC_BASE_URL || 'https://uppsalahalkbana.se';

/** Priset i kassan för ett kurstillfälle, med ev. rabattkod. Räknas alltid ut på servern. */
export async function checkoutOrder(sessionId: number, couponCode?: string | null): Promise<{ order: KlarnaOrderInput } | { error: string; status: number }> {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { course: true } });
  if (!session || session.status === 'canceled') return { error: 'Kursen finns inte eller är inställd', status: 404 };

  let amount = session.discountPrice ?? session.course.price;
  if (couponCode) {
    const coupon = await checkCoupon(couponCode, sessionId);
    if ('error' in coupon) return { error: coupon.error, status: 400 };
    amount = coupon.price;
  }
  if (amount <= 0) return { error: 'Inget att betala – bekräfta bokningen utan Klarna', status: 400 };

  const when = session.startTime.toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
  return {
    order: {
      amount,
      title: session.course.titleSv.trim(),
      description: when,
      productUrl: `${SITE()}/sv/courses`,
      imageUrl: `${SITE()}/logo.png`,
    },
  };
}

/** "Anna Maria Svensson" → { firstName: "Anna Maria", lastName: "Svensson" } */
export function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}
