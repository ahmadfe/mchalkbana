import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const data = await request.json();
  const course = await prisma.course.update({
    where: { id: parseInt(params.id) },
    data: { ...data, price: data.price ? parseInt(data.price) : undefined },
  });
  return NextResponse.json({ course });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  await prisma.course.delete({ where: { id: parseInt(params.id) } });
  return NextResponse.json({ success: true });
}
