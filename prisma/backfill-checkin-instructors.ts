// Sätter "Incheckad av" till kursens tilldelade lärare på incheckningar som saknar det.
// Kör: npx tsx prisma/backfill-checkin-instructors.ts [--dry-run]
import { prisma } from '../src/lib/db';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const entries = await prisma.riskRegisterEntry.findMany({ where: { instructorName: '' } });
  const bookings = await prisma.booking.findMany({ where: { checkedInAt: { not: null }, checkInInstructorName: null }, select: { id: true, sessionId: true } });
  const sessionIds = Array.from(new Set([...entries.map(e => e.sessionId), ...bookings.map(b => b.sessionId)].filter((x): x is number => !!x)));

  let updated = 0;
  const skipped: string[] = [];
  for (const sessionId of sessionIds) {
    const instructors = await prisma.user.findMany({
      where: { role: 'instructor', assignedSessions: { some: { id: sessionId } } },
      select: { id: true, name: true },
    });
    if (instructors.length !== 1) {
      skipped.push(`kurs ${sessionId}: ${instructors.length === 0 ? 'ingen lärare tilldelad' : `${instructors.length} lärare – välj för hand`}`);
      continue;
    }
    const [i] = instructors;
    if (!dryRun) {
      const a = await prisma.riskRegisterEntry.updateMany({ where: { sessionId, instructorName: '' }, data: { instructorId: i.id, instructorName: i.name } });
      await prisma.booking.updateMany({ where: { sessionId, checkedInAt: { not: null }, checkInInstructorName: null }, data: { checkInInstructorId: i.id, checkInInstructorName: i.name } });
      updated += a.count;
    }
    console.log(`kurs ${sessionId} → ${i.name}`);
  }
  console.log(`${dryRun ? '(test) ' : ''}${updated} rader i riskregistret uppdaterade`);
  if (skipped.length) console.log('Hoppade över:\n  ' + skipped.join('\n  '));
}

main().finally(() => prisma.$disconnect());
