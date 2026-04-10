export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  const { name, email, password, phone, language } = await request.json();

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
    data: {
      name,
      email,
      password: hashed,
      phone: phone || null,
      languagePref: language || 'sv',
      role: 'student',
    },
  });

  const token = await signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

  const response = NextResponse.json({ success: true, user: { userId: user.id, email: user.email, role: user.role, name: user.name } });
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return response;
}
