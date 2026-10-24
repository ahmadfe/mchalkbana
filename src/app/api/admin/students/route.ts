export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { archiveState, parseStudentInput, toStudentDto } from '@/lib/students';

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status'); // active (standard) | archived | all
  const filialId = url.searchParams.get('filialId');
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  const students = await prisma.student.findMany({
    where: filialId ? { filialId: Number(filialId) } : {},
    include: {
      filial: { select: { name: true } },
      bookings: {
        select: { status: true, session: { select: { startTime: true, endTime: true, status: true } } },
        orderBy: { session: { startTime: 'desc' } },
      },
    },
  });

  // Personnumret är krypterat, så sökningen görs här efter dekryptering.
  const qDigits = q.replace(/\D/g, '');
  const now = new Date();
  const rows = students
    .map(s => {
      const state = archiveState(s, s.bookings, now);
      const last = s.bookings.find(b => b.status !== 'Canceled' && b.session.status !== 'canceled');
      return {
        ...toStudentDto(s),
        archiveState: state,
        filialName: s.filial?.name ?? '',
        lastCourseAt: last?.session.startTime.toISOString() ?? null,
      };
    })
    .filter(s => statusParam === 'all' || (s.archiveState !== 'active') === (statusParam === 'archived'))
    .filter(s => {
      if (!q) return true;
      if (s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) return true;
      if (qDigits.length >= 3) {
        return s.personnummer.replace(/\D/g, '').includes(qDigits) || s.phone.replace(/\D/g, '').includes(qDigits);
      }
      return false;
    });

  rows.sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  return NextResponse.json({ students: rows });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const parsed = parseStudentInput(await request.json(), { partial: false });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.student.findUnique({
    where: { personnummerHash: parsed.data.personnummerHash as string },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'Det finns redan en elev med det personnumret', existingId: existing.id }, { status: 409 });
  }

  const student = await prisma.student.create({ data: parsed.data as Prisma.StudentUncheckedCreateInput });
  return NextResponse.json({ student: toStudentDto(student) }, { status: 201 });
}
