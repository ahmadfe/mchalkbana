import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const groups = await prisma.courseGroup.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Namn krävs' }, { status: 400 });
  }
  const group = await prisma.courseGroup.create({ data: { name: name.trim() } });
  return NextResponse.json({ group }, { status: 201 });
}

export async function DELETE(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const { id } = await request.json();
  await prisma.courseGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
