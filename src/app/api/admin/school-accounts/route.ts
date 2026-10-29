export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendSchoolAccountEmail } from '@/lib/email';
import { generatePassword } from '@/lib/instructors';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }
  const accounts = await prisma.user.findMany({
    // Inaktiverade skolor kan inte få nya platser
    where: { role: 'school', disabled: false },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').toLowerCase().trim();
  const phone = String(body.phone ?? '').trim() || null;
  // Utan lösenord skapas ett automatiskt, som mejlas till skolan och visas en gång för admin
  const password: string = body.password ? String(body.password) : generatePassword();
  if (!name || !email) {
    return NextResponse.json({ error: 'Namn och e-post krävs' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Ogiltig e-postadress' }, { status: 400 });
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
    data: { name, email, phone, password: hashed, role: 'school' },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  // Send credentials email
  await sendSchoolAccountEmail({ schoolName: name, email, password });

  return NextResponse.json({ account: user, ...(body.password ? {} : { password }) }, { status: 201 });
}
