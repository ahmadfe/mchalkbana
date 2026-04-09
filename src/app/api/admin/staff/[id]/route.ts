import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

// PATCH: reset password for a staff/admin account
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const userId = parseInt(params.id);
  const { password } = await request.json();

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Lösenordet måste vara minst 8 tecken' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Konto hittades inte' }, { status: 404 });
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return NextResponse.json({ success: true });
}
