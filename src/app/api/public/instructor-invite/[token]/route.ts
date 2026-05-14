import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const invite = await prisma.instructorInvite.findUnique({ where: { token: params.token } });
  if (!invite) return NextResponse.json({ error: 'Ogiltig länk' }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: 'Länken har redan använts' }, { status: 410 });
  if (new Date() > invite.expiresAt) return NextResponse.json({ error: 'Länken har gått ut' }, { status: 410 });
  return NextResponse.json({ email: invite.email, name: invite.name });
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const invite = await prisma.instructorInvite.findUnique({ where: { token: params.token } });
  if (!invite) return NextResponse.json({ error: 'Ogiltig länk' }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: 'Länken har redan använts' }, { status: 410 });
  if (new Date() > invite.expiresAt) return NextResponse.json({ error: 'Länken har gått ut' }, { status: 410 });

  const { name, password } = await request.json();
  if (!name || !password) return NextResponse.json({ error: 'Namn och lösenord krävs' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Lösenordet måste vara minst 8 tecken' }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) return NextResponse.json({ error: 'Kontot finns redan' }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email: invite.email, password: hashed, role: 'instructor' },
  });
  await prisma.instructorInvite.update({ where: { token: params.token }, data: { usedAt: new Date() } });

  return NextResponse.json({ success: true });
}
