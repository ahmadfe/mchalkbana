export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { enrollStudent } from '@/lib/enroll';

/** Anmäler en elev ur elevregistret till kursen. Admin tar en publik plats. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { studentId, sendConfirmation } = await request.json();
  const result = await enrollStudent(Number(params.id), Number(studentId), { sendConfirmation: !!sendConfirmation, bookedByRole: 'admin', seats: 'public' });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
