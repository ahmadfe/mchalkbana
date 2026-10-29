export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { readIdCards, type ScanImage } from '@/lib/idScan';
import { formatPersonnummer, hashPersonnummer, normalizePersonnummer } from '@/lib/personnummer';
import { personnummerChecksumOk } from '@/lib/pnr';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGES = 4;

/**
 * Läser legitimationerna på fotona och jämför med elevregistret och kursen.
 * Inget sparas här – admin granskar listan och sparar med /import.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  const sessionId = Number(params.id);
  const { images } = (await request.json()) as { images?: ScanImage[] };
  if (!Array.isArray(images) || images.length === 0) return NextResponse.json({ error: 'Välj minst ett foto' }, { status: 400 });
  if (images.length > MAX_IMAGES) return NextResponse.json({ error: `Högst ${MAX_IMAGES} foton åt gången` }, { status: 400 });
  if (images.some(i => !TYPES.includes(i.mediaType) || typeof i.data !== 'string' || !i.data)) {
    return NextResponse.json({ error: 'Fotona måste vara JPEG, PNG eller WebP' }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { seatLimit: true, status: true, bookings: { where: { status: { not: 'Canceled' } }, select: { personnummer: true, studentId: true } } },
  });
  if (!session) return NextResponse.json({ error: 'Kursen hittades inte' }, { status: 404 });

  const result = await readIdCards(images);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 502 });

  const bookedPnr = new Set(session.bookings.map(b => normalizePersonnummer(b.personnummer)).filter(Boolean));
  const bookedStudents = new Set(session.bookings.map(b => b.studentId).filter(Boolean));

  const rows = await Promise.all(result.cards.map(async c => {
    const pnr = c.personnummer.includes('?') ? null : normalizePersonnummer(c.personnummer);
    const valid = !!pnr && personnummerChecksumOk(pnr);
    const student = valid ? await prisma.student.findUnique({ where: { personnummerHash: hashPersonnummer(pnr!) }, select: { id: true, firstName: true, lastName: true } }) : null;
    return {
      firstName: c.firstName.trim(),
      lastName: c.lastName.trim(),
      personnummer: pnr ? formatPersonnummer(pnr) : c.personnummer,
      idType: c.idType,
      confidence: c.confidence,
      note: c.note,
      checksumOk: valid,
      existingStudent: student ? `${student.firstName} ${student.lastName}`.trim() : null,
      alreadyBooked: (!!pnr && bookedPnr.has(pnr)) || (!!student && bookedStudents.has(student.id)),
    };
  }));

  return NextResponse.json({ rows, freeSeats: Math.max(0, session.seatLimit - session.bookings.length) });
}
