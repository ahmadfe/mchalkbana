import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendStaffAccountEmail } from '@/lib/email';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const staff = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ staff });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const { name, email, password } = await request.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Namn, e-post och lösenord krävs' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Lösenordet måste vara minst 8 tecken' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'E-postadressen används redan' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: 'admin' },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  await sendStaffAccountEmail({ name, email, password });

  return NextResponse.json({ user }, { status: 201 });
}

export async function DELETE(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const { id } = await request.json();

  // Prevent deleting yourself
  if (id === authUser.userId) {
    return NextResponse.json({ error: 'Du kan inte ta bort ditt eget konto' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Konto hittades inte' }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
