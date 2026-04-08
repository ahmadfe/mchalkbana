import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const cards = await prisma.infoCard.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json({ cards });
}

export async function POST(request: Request) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const body = await request.json();
  const { title, description, price, imageUrl, buttonText, buttonLink, sortOrder, visible } = body;

  if (!title || !description) {
    return NextResponse.json({ error: 'Titel och beskrivning krävs' }, { status: 400 });
  }

  const card = await prisma.infoCard.create({
    data: {
      title,
      description,
      price: price ?? '',
      imageUrl: imageUrl ?? '',
      buttonText: buttonText ?? 'Läs mer',
      buttonLink: buttonLink ?? '/courses',
      sortOrder: sortOrder ?? 0,
      visible: visible ?? true,
    },
  });
  return NextResponse.json({ card }, { status: 201 });
}
