export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await prisma.session.findUnique({
    where: { id: parseInt(params.id) },
    include: { course: true, school: true },
  });
  if (!session) return NextResponse.json({ error: 'Inte hittad' }, { status: 404 });
  return NextResponse.json({ session });
}
