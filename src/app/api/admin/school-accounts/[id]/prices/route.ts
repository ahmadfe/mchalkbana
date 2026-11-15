import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

// GET: return all custom course prices for a school account
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const schoolUserId = parseInt(params.id);
  const prices = await prisma.schoolCoursePrice.findMany({
    where: { schoolUserId },
    include: { course: { select: { id: true, titleSv: true } } },
  });

  return NextResponse.json({ prices });
}

// PUT: skolans priser. Body: { prices: [{ courseId, part?, price }] } – part för kombokurser (both | risk1 | risk2).
// Kurser/delar som inte skickas med får inget eget pris (ordinarie pris eller automatiskt delpris används).
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const schoolUserId = parseInt(params.id);
  const { prices } = await request.json() as { prices: { courseId: number; part?: string; price: number }[] };
  if (!Array.isArray(prices)) return NextResponse.json({ error: 'Ogiltigt format' }, { status: 400 });
  const rows = prices.map(p => ({ courseId: Number(p.courseId), part: p.part === 'risk1' || p.part === 'risk2' ? p.part : 'both', price: Math.round(Number(p.price)) }));
  if (rows.some(r => !Number.isInteger(r.courseId) || !Number.isFinite(r.price) || r.price < 0)) return NextResponse.json({ error: 'Ogiltigt pris' }, { status: 400 });

  await prisma.$transaction([
    prisma.schoolCoursePrice.deleteMany({ where: { schoolUserId } }),
    prisma.schoolCoursePrice.createMany({ data: rows.map(r => ({ schoolUserId, ...r })) }),
  ]);
  return NextResponse.json({ success: true });
}
