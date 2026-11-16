export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSchool } from '@/lib/auth';
import { courseKind } from '@/lib/courseKind';

// GET: skolans egna priser – priceMap (courseId → pris för hela kursen) och en lista med kursnamn
export async function GET(request: Request) {
  const authUser = await requireSchool(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const rows = await prisma.schoolCoursePrice.findMany({
    where: { schoolUserId: authUser.userId },
    select: { courseId: true, part: true, price: true, course: { select: { titleSv: true, type: true, price: true } } },
    orderBy: [{ course: { titleSv: 'asc' } }, { part: 'asc' }],
  });

  const priceMap: Record<number, number> = {};
  for (const p of rows) if (p.part === 'both') priceMap[p.courseId] = p.price;

  const order: Record<string, number> = { both: 0, risk1: 1, risk2: 2 };
  const list = rows
    .map(p => ({
      courseId: p.courseId,
      title: p.course.titleSv,
      part: p.part,
      kombo: courseKind(p.course.type) === 'kombo',
      price: p.price,
      listPrice: p.course.price,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'sv') || a.courseId - b.courseId || (order[a.part] ?? 9) - (order[b.part] ?? 9))
    // Samma kursnamn + del + pris (t.ex. två kursslag med samma namn) visas en gång
    .filter((p, i, all) => all.findIndex(x => x.title === p.title && x.part === p.part && x.price === p.price) === i);

  return NextResponse.json({ priceMap, list });
}
