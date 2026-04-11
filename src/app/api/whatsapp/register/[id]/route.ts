import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';

// DELETE — remove a registered number
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const existing = await prisma.whatsappNumber.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Number not found' }, { status: 404 });

  await prisma.whatsappNumber.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
