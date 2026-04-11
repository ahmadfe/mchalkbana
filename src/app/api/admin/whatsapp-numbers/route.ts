import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

// GET — list all registered WhatsApp numbers
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const numbers = await prisma.whatsappNumber.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ numbers });
}

// POST — register a new admin number
export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const { phone } = await request.json();
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

  const normalized = phone.startsWith('+') ? phone : `+${phone}`;

  const existing = await prisma.whatsappNumber.findUnique({ where: { phone: normalized } });
  if (existing) return NextResponse.json({ error: 'Numret är redan registrerat' }, { status: 409 });

  const number = await prisma.whatsappNumber.create({
    data: { phone: normalized, role: 'admin' },
  });

  return NextResponse.json({ number }, { status: 201 });
}
