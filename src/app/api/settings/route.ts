export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keys = searchParams.get('keys')?.split(',').filter(Boolean) ?? [];

  if (keys.length > 0) {
    const settings = await prisma.settings.findMany({ where: { key: { in: keys } } });
    const result: Record<string, string> = {};
    for (const s of settings) result[s.key] = s.value;
    return NextResponse.json(result);
  }

  return NextResponse.json({});
}
