import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';

// GET — list all registered numbers
export async function GET(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const numbers = await prisma.whatsappNumber.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ numbers });
}

// POST — register a new admin number
// Body: { phone: "+46701234567" }
export async function POST(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phone } = await request.json();
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

  const existing = await prisma.whatsappNumber.findUnique({ where: { phone } });
  if (existing) return NextResponse.json({ error: 'Number already registered' }, { status: 409 });

  const number = await prisma.whatsappNumber.create({
    data: { phone, role: 'admin' },
  });

  return NextResponse.json({ number }, { status: 201 });
}
