export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { generatePassword, sendInstructorCredentialsEmail } from '@/lib/instructors';

async function findInstructor(id: number) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true, role: true } });
  return user?.role === 'instructor' ? user : null;
}

/** Ändra namn/e-post/telefon, eller återställ lösenordet med { resetPassword: true }. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const instructor = await findInstructor(Number(params.id));
  if (!instructor) return NextResponse.json({ error: 'Instruktören hittades inte' }, { status: 404 });
  const body = await request.json();

  if (body.resetPassword) {
    const password = generatePassword();
    await prisma.user.update({ where: { id: instructor.id }, data: { password: await bcrypt.hash(password, 12) } });
    await sendInstructorCredentialsEmail({ email: instructor.email, name: instructor.name, password, reset: true });
    return NextResponse.json({ password });
  }

  const data: { name?: string; email?: string; phone?: string | null } = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) return NextResponse.json({ error: 'Namn krävs' }, { status: 400 });
    data.name = String(body.name).trim();
  }
  if (body.email !== undefined) {
    const email = String(body.email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Ogiltig e-postadress' }, { status: 400 });
    const taken = await prisma.user.findFirst({ where: { email, id: { not: instructor.id } }, select: { id: true } });
    if (taken) return NextResponse.json({ error: 'E-postadressen används redan av ett annat konto' }, { status: 409 });
    data.email = email;
  }
  if (body.phone !== undefined) data.phone = String(body.phone).trim() || null;

  const user = await prisma.user.update({ where: { id: instructor.id }, data, select: { id: true, name: true, email: true, phone: true } });
  return NextResponse.json({ instructor: user });
}

/** Tar bort kontot. Incheckningar och riskregistret behåller lärarens namn. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const instructor = await findInstructor(Number(params.id));
  if (!instructor) return NextResponse.json({ error: 'Instruktören hittades inte' }, { status: 404 });
  await prisma.user.delete({ where: { id: instructor.id } });
  return NextResponse.json({ ok: true });
}
