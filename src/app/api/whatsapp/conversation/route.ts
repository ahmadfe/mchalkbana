import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';

// GET /api/whatsapp/conversation?phone=+46701234567
export async function GET(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

  const conv = await prisma.whatsappConversation.findUnique({ where: { phone } });

  return NextResponse.json({
    phone,
    state: conv?.state ?? 'idle',
    data: conv?.data ?? {},
    updatedAt: conv?.updatedAt ?? null,
  });
}

// POST /api/whatsapp/conversation
// Body: { phone, state, data }
export async function POST(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phone, state, data } = await request.json();
  if (!phone || !state) return NextResponse.json({ error: 'phone and state required' }, { status: 400 });

  const conv = await prisma.whatsappConversation.upsert({
    where: { phone },
    create: { phone, state, data: data ?? {} },
    update: { state, data: data ?? {} },
  });

  return NextResponse.json({ phone: conv.phone, state: conv.state, data: conv.data });
}

// DELETE /api/whatsapp/conversation?phone=+46701234567
// Reset conversation to idle (called after booking complete or timeout)
export async function DELETE(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

  await prisma.whatsappConversation.deleteMany({ where: { phone } });

  return NextResponse.json({ success: true });
}
