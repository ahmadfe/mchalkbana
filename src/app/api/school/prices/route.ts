export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSchool } from '@/lib/auth';

// GET: return the authenticated school's custom prices (courseId → price)
export async function GET(request: Request) {
  const authUser = await requireSchool(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const prices = await prisma.schoolCoursePrice.findMany({
    where: { schoolUserId: authUser.userId },
    select: { courseId: true, price: true },
  });

  // Return as a simple map { courseId: price }
  const priceMap: Record<number, number> = {};
  for (const p of prices) {
    priceMap[p.courseId] = p.price;
  }

  return NextResponse.json({ priceMap });
}
