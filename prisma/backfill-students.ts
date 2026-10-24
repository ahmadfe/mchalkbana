// Skapar elever i elevregistret från befintliga bokningar. Går att köra flera gånger.
// Kör: npx tsx prisma/backfill-students.ts [--dry-run]
import { prisma } from '../src/lib/db';
import { encryptPersonnummer, hashPersonnummer, normalizePersonnummer } from '../src/lib/personnummer';
import { courseKind, splitName } from '../src/lib/students';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const bookings = await prisma.booking.findMany({
    include: { session: { include: { course: true } }, user: true },
    orderBy: { bookingTime: 'asc' },
  });

  const groups = new Map<string, typeof bookings>();
  let skipped = 0;
  for (const b of bookings) {
    const pnr = normalizePersonnummer(b.personnummer);
    if (!pnr) { skipped++; continue; }
    groups.set(pnr, [...(groups.get(pnr) ?? []), b]);
  }
  console.log(`${bookings.length} bokningar → ${groups.size} elever (${skipped} utan giltigt personnummer)`);
  if (dryRun) return;

  let created = 0;
  for (const [pnr, list] of Array.from(groups)) {
    const latest = list[list.length - 1];
    const hash = hashPersonnummer(pnr);

    let risk1DoneAt: Date | null = null;
    let risk2DoneAt: Date | null = null;
    for (const b of list) {
      if (b.result !== 'passed') continue;
      const kind = courseKind(b.session.course.type);
      if (kind === 'risk1' || kind === 'kombo') risk1DoneAt = b.session.startTime;
      if (kind === 'risk2' || kind === 'kombo') risk2DoneAt = b.session.startTime;
    }

    const existing = await prisma.student.findUnique({ where: { personnummerHash: hash } });
    const student = existing ?? await prisma.student.create({
      data: {
        ...splitName(latest.guestName ?? latest.user?.name ?? ''),
        personnummerHash: hash,
        personnummerEnc: encryptPersonnummer(pnr),
        email: latest.guestEmail ?? latest.user?.email ?? '',
        phone: latest.guestPhone ?? latest.user?.phone ?? '',
        filialId: latest.session.schoolId,
        risk1DoneAt,
        risk2DoneAt,
      },
    });
    if (!existing) created++;

    await prisma.booking.updateMany({
      where: { id: { in: list.map(b => b.id) }, studentId: null },
      data: { studentId: student.id },
    });
    await prisma.booking.updateMany({
      where: { id: { in: list.filter(b => b.result === 'passed').map(b => b.id) }, attendance: 'registered' },
      data: { attendance: 'attended' },
    });
  }
  console.log(`Klart: ${created} nya elever skapade`);
}

main().finally(() => prisma.$disconnect());
