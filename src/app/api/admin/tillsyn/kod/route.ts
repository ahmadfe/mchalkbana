export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { createExportCode } from '@/lib/tillsyn';
import { sendExportCodeEmail } from '@/lib/email';

/** Skickar en engångskod till adminens e-post. */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const user = await prisma.user.findUnique({ where: { id: admin.userId }, select: { email: true, name: true } });
  if (!user) return NextResponse.json({ error: 'Kontot hittades inte' }, { status: 404 });

  const result = await createExportCode(admin.userId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 429 });
  const sent = await sendExportCodeEmail({ email: user.email, name: user.name, code: result.code });
  if (!sent) return NextResponse.json({ error: 'Kunde inte skicka koden – försök igen' }, { status: 502 });

  // Visa bara början av adressen så att man ser vart koden gick
  const [local, domain] = user.email.split('@');
  return NextResponse.json({ sentTo: `${local.slice(0, 2)}…@${domain}` });
}
