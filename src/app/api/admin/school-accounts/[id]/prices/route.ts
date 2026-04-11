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

// PUT: upsert custom prices for a school account
// Body: { prices: [{ courseId: number, price: number }] }
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const schoolUserId = parseInt(params.id);
  const { prices } = await request.json() as { prices: { courseId: number; price: number }[] };

  if (!Array.isArray(prices)) {
    return NextResponse.json({ error: 'Ogiltigt format' }, { status: 400 });
  }

  // Upsert each price entry
  await Promise.all(
    prices.map((p) =>
      prisma.schoolCoursePrice.upsert({
        where: { schoolUserId_courseId: { schoolUserId, courseId: p.courseId } },
        create: { schoolUserId, courseId: p.courseId, price: p.price },
        update: { price: p.price },
      })
    )
  );

  // Delete entries not in the submitted list (courses without a custom price)
  const submittedCourseIds = prices.map((p) => p.courseId);
  await prisma.schoolCoursePrice.deleteMany({
    where: { schoolUserId, courseId: { notIn: submittedCourseIds } },
  });

  return NextResponse.json({ success: true });
}
