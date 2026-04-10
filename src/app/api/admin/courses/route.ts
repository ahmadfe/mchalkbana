import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const courses = await prisma.course.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json({ courses });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const { titleSv, titleEn, description, type, vehicle, price, location, receiptMessage } = await request.json();
  if (!titleSv || !type || !vehicle || !price) {
    return NextResponse.json({ error: 'Obligatoriska fält saknas' }, { status: 400 });
  }

  const course = await prisma.course.create({
    data: { titleSv, titleEn: titleEn || titleSv, description: description || '', type, vehicle, price: parseInt(price), location: location || '', receiptMessage: receiptMessage || '' },
  });
  return NextResponse.json({ course }, { status: 201 });
}
