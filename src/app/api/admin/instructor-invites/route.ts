import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { sendInstructorInviteEmail } from '@/lib/email';
import crypto from 'crypto';

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
  if (!email) return NextResponse.json({ error: 'E-post krävs' }, { status: 400 });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await prisma.instructorInvite.create({
    data: { token, email: email.toLowerCase().trim(), name: name || null, expiresAt },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://uppsalahalkbana.se';
  const registerUrl = `${baseUrl}/sv/instruktor/registrera/${token}`;

  await sendInstructorInviteEmail({ email: invite.email, name: invite.name || undefined, registerUrl });

  return NextResponse.json({ invite });
}
