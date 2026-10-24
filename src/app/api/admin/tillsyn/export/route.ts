export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { elevregister, kursregister, parsePeriod, riskregister, toCsv, verifyExportToken } from '@/lib/tillsyn';

const KINDS = { elevregister, kursregister, riskregister } as const;

/** Register med personnummer. Kräver biljett från engångskoden och loggas. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  if (!(await verifyExportToken(request.headers.get('x-export-token'), admin.userId))) {
    return NextResponse.json({ error: 'Koden har gått ut – bekräfta igen' }, { status: 401 });
  }
  if (!process.env.ENCRYPTION_KEY) return NextResponse.json({ error: 'Krypteringsnyckeln (ENCRYPTION_KEY) saknas på servern' }, { status: 500 });

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') as keyof typeof KINDS;
  const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';
  if (!(kind in KINDS)) return NextResponse.json({ error: 'Okänt register' }, { status: 400 });
  const period = parsePeriod(url.searchParams.get('period'));
  if (kind !== 'riskregister' && !period) return NextResponse.json({ error: 'Ogiltig period' }, { status: 400 });

  const table = kind === 'riskregister' ? await riskregister() : await KINDS[kind](period!);
  await prisma.exportLog.create({
    data: { userId: admin.userId, userName: admin.name, kind: `${kind}.${format}`, period: kind === 'riskregister' ? '5 år' : period!.label },
  });

  if (format === 'json') return NextResponse.json(table);
  const filename = `${kind}-${kind === 'riskregister' ? new Date().toISOString().slice(0, 10) : period!.label.replace('–', '-')}.csv`;
  return new NextResponse(toCsv(table), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' },
  });
}
