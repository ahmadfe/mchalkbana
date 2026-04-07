import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (key) {
    const setting = await prisma.settings.findUnique({ where: { key } });
    return NextResponse.json({ value: setting?.value || '' });
  }

  const settings = await prisma.settings.findMany();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const { key, value } = await request.json();
  if (!key) return NextResponse.json({ error: 'key krävs' }, { status: 400 });

  const setting = await prisma.settings.upsert({
    where: { key },
    update: { value: value ?? '' },
    create: { key, value: value ?? '' },
  });

  return NextResponse.json({ setting });
}
