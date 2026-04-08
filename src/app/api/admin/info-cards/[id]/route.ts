import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { del } from '@vercel/blob';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'Ogiltigt ID' }, { status: 400 });

  const body = await request.json();
  const {
    badge, title, description, price,
    imageUrl, videoUrl,
    primaryButtonText, primaryButtonLink,
    secondaryButtonText, secondaryButtonLink,
    sortOrder, visible,
  } = body;

  const card = await prisma.infoCard.update({
    where: { id },
    data: {
      badge, title, description, price,
      imageUrl, videoUrl,
      primaryButtonText, primaryButtonLink,
      secondaryButtonText, secondaryButtonLink,
      sortOrder, visible,
    },
  });
  return NextResponse.json({ card });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'Ogiltigt ID' }, { status: 400 });

  const card = await prisma.infoCard.findUnique({ where: { id } });
  if (card?.imageUrl) {
    try { await del(card.imageUrl); } catch { /* ignore */ }
  }

  await prisma.infoCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
