export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireInstructor } from '@/lib/auth';
import { createOrFindStudent, enrollStudent, searchStudents } from '@/lib/enroll';

/** Läraren får bara hantera elever på kurser hen är tilldelad. */
async function assignedSession(request: Request, sessionId: number) {
  const user = await requireInstructor(request);
  if (!user) return null;
  const n = await prisma.session.count({ where: { id: sessionId, assignedSchoolUsers: { some: { id: user.userId } } } });
  return n > 0 ? user : null;
}

/** Sök i elevregistret: ?q=namn, personnummer, telefon eller e-post */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await assignedSession(request, Number(params.id)))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json({ students: await searchStudents(q) });
}

/**
 * Anmäl en elev som saknas på listan: { studentId } för en elev i registret,
 * eller { firstName, lastName, personnummer, phone, email } för en ny elev. { sendConfirmation } mejlar bekräftelse.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const sessionId = Number(params.id);
  if (!(await assignedSession(request, sessionId))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const body = await request.json();

  let studentId = Number(body.studentId) || 0;
  let existed = false;
  if (!studentId) {
    const created = await createOrFindStudent(body);
    if ('error' in created) return NextResponse.json({ error: created.error }, { status: 400 });
    studentId = created.studentId;
    existed = created.existed;
  }
  const result = await enrollStudent(sessionId, studentId, { sendConfirmation: !!body.sendConfirmation, bookedByRole: 'instructor', seats: 'physical' });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ...result, existed }, { status: 201 });
}
