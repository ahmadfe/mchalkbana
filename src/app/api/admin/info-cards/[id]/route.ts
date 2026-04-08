import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'Ogiltigt ID' }, { status: 400 });

  const body = await request.json();
  const { title, description, price, imageKeyword, buttonText, buttonLink, sortOrder, visible } = body;

  const card = await prisma.infoCard.update({
    where: { id },
    data: { title, description, price, imageKeyword, buttonText, buttonLink, sortOrder, visible },
  });
  return NextResponse.json({ card });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'Ogiltigt ID' }, { status: 400 });

  await prisma.infoCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
