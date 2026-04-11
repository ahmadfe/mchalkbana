import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';

// POST { phone: "+46701234567" }
// Returns { role: "admin" | "guest" }
export async function POST(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phone } = await request.json();
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

  const registered = await prisma.whatsappNumber.findUnique({ where: { phone } });

  return NextResponse.json({ role: registered ? registered.role : 'guest' });
}
