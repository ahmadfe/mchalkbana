import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const sessionId = parseInt(params.id);
  const { instructorIds } = await request.json();
  const ids: number[] = Array.isArray(instructorIds) ? instructorIds.map(Number).filter(Boolean) : [];

  // Get existing non-instructor assigned users to preserve them
  const existing = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { assignedSchoolUsers: { where: { role: { not: 'instructor' } }, select: { id: true } } },
  });
  const nonInstructorIds = (existing?.assignedSchoolUsers || []).map((u) => u.id);
  const allIds = Array.from(new Set([...nonInstructorIds, ...ids]));

  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { assignedSchoolUsers: { set: allIds.map((id) => ({ id })) } },
    include: { assignedSchoolUsers: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json({ session });
}
