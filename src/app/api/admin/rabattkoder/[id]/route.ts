export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { couponState, discountLabel, formatCode } from '@/lib/coupons';

/** En omgång med alla koder och vem som använt dem */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const batch = await prisma.couponBatch.findUnique({
    where: { id: Number(params.id) },
    include: {
      coupons: {
        orderBy: { id: 'asc' },
        include: {
          bookings: {
            where: { status: { not: 'Canceled' } },
            orderBy: { bookingTime: 'desc' },
            select: {
              id: true, status: true, bookingTime: true, guestName: true, price: true, couponDiscount: true,
              user: { select: { name: true } },
              session: { select: { id: true, startTime: true, course: { select: { titleSv: true } } } },
            },
          },
        },
      },
    },
  });
  if (!batch) return NextResponse.json({ error: 'Omgången hittades inte' }, { status: 404 });
  const courses = await prisma.course.findMany({ where: { id: { in: batch.courseIds } }, select: { titleSv: true } });
  const now = new Date();

  return NextResponse.json({
    batch: {
      id: batch.id,
      name: batch.name,
      label: discountLabel(batch.kind, batch.value),
      validTo: batch.validTo?.toISOString() ?? null,
      courses: courses.map(c => c.titleSv),
      createdBy: batch.createdBy,
      createdAt: batch.createdAt.toISOString(),
    },
    codes: batch.coupons.map(c => {
      const state = couponState({ disabled: c.disabled, batch }, c.bookings, now);
      const b = c.bookings.find(x => x.status === 'Paid' || x.status === 'Confirmed') ?? (state === 'reserved' ? c.bookings[0] : null);
      return {
        id: c.id,
        code: formatCode(c.code),
        state,
        disabled: c.disabled,
        booking: b ? {
          name: b.guestName || b.user?.name || '–',
          sessionId: b.session.id,
          course: b.session.course.titleSv,
          startTime: b.session.startTime.toISOString(),
          price: b.price,
          discount: b.couponDiscount,
        } : null,
      };
    }),
  });
}

/** { disabled } stänger av eller sätter på alla oanvända koder i omgången */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { disabled } = await request.json();
  await prisma.coupon.updateMany({ where: { batchId: Number(params.id) }, data: { disabled: !!disabled } });
  return NextResponse.json({ ok: true });
}

/** Tar bort en omgång – bara om ingen kod har använts */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.id);
  const used = await prisma.booking.count({ where: { coupon: { batchId: id }, status: { in: ['Paid', 'Confirmed', 'Pending'] } } });
  if (used > 0) return NextResponse.json({ error: 'Koder i omgången har använts – stäng av dem i stället' }, { status: 409 });
  await prisma.couponBatch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
