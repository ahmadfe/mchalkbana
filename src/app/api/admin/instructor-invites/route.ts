import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generatePassword, sendInstructorCredentialsEmail } from '@/lib/instructors';

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const invites = await prisma.instructorInvite.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ invites });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const { email, name } = await request.json();
  if (!email || !name) return NextResponse.json({ error: 'E-post och namn krävs' }, { status: 400 });

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return NextResponse.json({ error: 'Kontot finns redan' }, { status: 409 });

  const plainPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.create({
    data: { name, email: normalizedEmail, password: hashedPassword, role: 'instructor' },
  });

  // Log invite for audit trail
  const token = crypto.randomBytes(16).toString('hex');
  const invite = await prisma.instructorInvite.create({
    data: { token, email: normalizedEmail, name, usedAt: new Date(), expiresAt: new Date() },
  });

  await sendInstructorCredentialsEmail({ email: normalizedEmail, name, password: plainPassword });

  return NextResponse.json({ invite, user: { id: user.id, name: user.name, email: user.email }, password: plainPassword });
}
