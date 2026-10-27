export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/** Förslag på mötesplatser: kursslagens adresser, filialer och tidigare skolreservationer. */
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const [courses, filialer, reservations] = await Promise.all([
    prisma.course.findMany({ select: { location: true } }),
    prisma.school.findMany({ where: { active: true }, select: { address: true } }),
    prisma.sessionSchoolAllocation.findMany({ where: { meetingPlace: { not: '' } }, select: { meetingPlace: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
  ]);
  const all = [...reservations.map(r => r.meetingPlace), ...courses.map(c => c.location), ...filialer.map(f => f.address)]
    .map(s => s.trim())
    .filter(Boolean);
  return NextResponse.json({ motesplatser: Array.from(new Set(all)) });
}
