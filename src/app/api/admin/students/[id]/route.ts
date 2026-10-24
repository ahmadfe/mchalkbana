export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { archiveState, parseStudentInput, toStudentDto } from '@/lib/students';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const student = await prisma.student.findUnique({
    where: { id: Number(params.id) },
    include: {
      bookings: {
        include: {
          session: { include: { course: { select: { titleSv: true, type: true } }, school: { select: { name: true } } } },
          payment: { select: { amount: true, status: true, provider: true } },
          checkedInBy: { select: { name: true } },
        },
        orderBy: { session: { startTime: 'desc' } },
      },
    },
  });
  if (!student) return NextResponse.json({ error: 'Eleven hittades inte' }, { status: 404 });

  const bookings = student.bookings.map(b => ({
    id: b.id,
    sessionId: b.sessionId,
    startTime: b.session.startTime.toISOString(),
    endTime: b.session.endTime.toISOString(),
    courseTitle: b.session.course.titleSv,
    courseType: b.session.course.type,
    filialName: b.session.school.name,
    status: b.status,
    attendance: b.attendance,
    result: b.result,
    checkedInAt: b.checkedInAt?.toISOString() ?? null,
    checkedInBy: b.checkedInBy?.name ?? null,
    idType: b.idType,
    payment: b.payment,
  }));

  return NextResponse.json({ student: toStudentDto(student), bookings, archiveState: archiveState(student, student.bookings) });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const id = Number(params.id);

  const current = await prisma.student.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: 'Eleven hittades inte' }, { status: 404 });

  const parsed = parseStudentInput(await request.json(), { partial: true });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data } = parsed;

  // Behåll ursprungligt datum för GDPR-information om den redan är given
  if (data.gdprInformedAt instanceof Date && current.gdprInformedAt) delete data.gdprInformedAt;

  if (data.personnummerHash && data.personnummerHash !== current.personnummerHash) {
    const clash = await prisma.student.findUnique({ where: { personnummerHash: data.personnummerHash as string }, select: { id: true } });
    if (clash) return NextResponse.json({ error: 'Det finns redan en elev med det personnumret', existingId: clash.id }, { status: 409 });
  } else {
    // Oförändrat personnummer – skriv inte om krypteringen i onödan
    delete data.personnummerHash;
    delete data.personnummerEnc;
  }

  const student = await prisma.student.update({ where: { id }, data });
  return NextResponse.json({ student: toStudentDto(student) });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  // Bokningarna och riskregistret ligger kvar; bokningarna kopplas bara loss från eleven.
  await prisma.student.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
