export const dynamic = 'force-dynamic';
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
  if (!key) return NextResponse.json({ note: '' });

  const setting = await prisma.settings.findUnique({
    where: { key: `student_note_${key}` },
  });
  return NextResponse.json({ note: setting?.value ?? '' });
}

export async function PUT(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const { key, note } = await request.json();
  if (!key) return NextResponse.json({ error: 'Key krävs' }, { status: 400 });

  await prisma.settings.upsert({
    where: { key: `student_note_${key}` },
    update: { value: note ?? '' },
    create: { key: `student_note_${key}`, value: note ?? '' },
  });
  return NextResponse.json({ success: true });
}
