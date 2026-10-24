export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const filialer = await prisma.school.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { students: true, sessions: true } } },
  });
  return NextResponse.json({ filialer });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const { name, address, city, bana, contactEmail } = await request.json();
  if (!name?.trim() || !address?.trim()) return NextResponse.json({ error: 'Namn och adress krävs' }, { status: 400 });
  const filial = await prisma.school.create({
    data: { name: name.trim(), address: address.trim(), city: (city ?? '').trim(), bana: (bana ?? '').trim(), contactEmail: (contactEmail ?? '').trim() },
  });
  return NextResponse.json({ filial }, { status: 201 });
}
