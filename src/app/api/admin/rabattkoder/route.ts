export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { couponState, discountLabel, generateCodes } from '@/lib/coupons';
import { stockholmDay } from '@/lib/kurser';

const MAX_CODES = 500;

/** Alla omgångar med räknare, plus kurserna att välja bland i formuläret */
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const [batches, courses] = await Promise.all([
    prisma.couponBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { coupons: { select: { disabled: true, bookings: { where: { status: { not: 'Canceled' } }, select: { status: true, bookingTime: true, couponDiscount: true } } } } },
    }),
    prisma.course.findMany({ orderBy: { id: 'asc' }, select: { id: true, titleSv: true, behorighet: true } }),
  ]);
  const courseName = new Map(courses.map(c => [c.id, c.titleSv]));
  const now = new Date();

  return NextResponse.json({
    courses: courses.map(c => ({ id: c.id, title: c.titleSv })),
    batches: batches.map(b => {
      const states = b.coupons.map(c => couponState({ disabled: c.disabled, batch: b }, c.bookings, now));
      const count = (s: string) => states.filter(x => x === s).length;
      return {
        id: b.id,
        name: b.name,
        label: discountLabel(b.kind, b.value),
        validTo: b.validTo?.toISOString() ?? null,
        courses: b.courseIds.map(id => courseName.get(id) ?? `Kurs ${id}`),
        createdBy: b.createdBy,
        createdAt: b.createdAt.toISOString(),
        total: b.coupons.length,
        used: count('used'),
        available: count('unused') + count('reserved'),
        discountTotal: b.coupons.reduce((s, c) => s + c.bookings.filter(x => x.status === 'Paid' || x.status === 'Confirmed').reduce((t, x) => t + (x.couponDiscount ?? 0), 0), 0),
      };
    }),
  });
}

/** Ny omgång: { name, kind, value, count, validTo: 'YYYY-MM-DD' | null, courseIds } */
export async function POST(request: Request) {
  const me = await requireAdmin(request);
  if (!me) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const body = await request.json();
  const name = String(body.name ?? '').trim();
  const kind = body.kind === 'amount' ? 'amount' : body.kind === 'percent' ? 'percent' : null;
  const value = Number(body.value);
  const count = Number(body.count);
  const courseIds = Array.isArray(body.courseIds) ? body.courseIds.map(Number).filter(Number.isInteger) : [];

  if (!name) return NextResponse.json({ error: 'Ge omgången ett namn, t.ex. "Partner X"' }, { status: 400 });
  if (!kind) return NextResponse.json({ error: 'Välj procent eller kronor' }, { status: 400 });
  if (!Number.isInteger(value) || value <= 0 || (kind === 'percent' && value > 100)) {
    return NextResponse.json({ error: kind === 'percent' ? 'Rabatten ska vara 1–100 %' : 'Rabatten ska vara hela kronor' }, { status: 400 });
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_CODES) return NextResponse.json({ error: `Antal koder: 1–${MAX_CODES}` }, { status: 400 });

  let validTo: Date | null = null;
  if (body.validTo) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.validTo)) return NextResponse.json({ error: 'Ogiltigt datum' }, { status: 400 });
    // Gäller till och med dagen (svensk tid)
    validTo = stockholmDay(new Date(`${body.validTo}T12:00:00Z`)).to;
    if (validTo <= new Date()) return NextResponse.json({ error: 'Sista giltighetsdag har redan passerat' }, { status: 400 });
  }

  const codes = await generateCodes(count);
  const batch = await prisma.couponBatch.create({
    data: {
      name, kind, value, validTo, courseIds,
      createdBy: me.name || me.email,
      coupons: { createMany: { data: codes.map(code => ({ code })) } },
    },
  });
  return NextResponse.json({ id: batch.id }, { status: 201 });
}
