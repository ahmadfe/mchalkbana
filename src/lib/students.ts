import { prisma } from './db';
import { encryptPersonnummer, hashPersonnummer, normalizePersonnummer } from './personnummer';

export type CourseKind = 'risk1' | 'risk2' | 'kombo' | 'other';

/** Kurstyperna i databasen är fritext ("Risk 2", "Risk2", "Kombo " ...). */
export function courseKind(type: string): CourseKind {
  const t = type.toLowerCase().replace(/\s+/g, '');
  if (t.startsWith('kombo') || t.includes('1+2')) return 'kombo';
  if (t.includes('risk1')) return 'risk1';
  if (t.includes('risk2') || t.includes('halka')) return 'risk2';
  return 'other';
}

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/**
 * Kopplar en bokning till en elev i elevregistret (matchat på personnummer) och skapar eleven om den saknas.
 * Får aldrig stoppa en bokning – fel loggas bara.
 */
export async function linkBookingToStudent(bookingId: number): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { session: { select: { schoolId: true } }, user: true },
    });
    if (!booking || booking.studentId) return;
    const pnr = normalizePersonnummer(booking.personnummer);
    if (!pnr) return;

    const hash = hashPersonnummer(pnr);
    const name = splitName(booking.guestName ?? booking.user?.name ?? '');
    const student = await prisma.student.upsert({
      where: { personnummerHash: hash },
      update: {},
      create: {
        ...name,
        personnummerHash: hash,
        personnummerEnc: encryptPersonnummer(pnr),
        email: booking.guestEmail ?? booking.user?.email ?? '',
        phone: booking.guestPhone ?? booking.user?.phone ?? '',
        filialId: booking.session.schoolId,
      },
    });
    await prisma.booking.update({ where: { id: bookingId }, data: { studentId: student.id } });
  } catch (err) {
    console.error('linkBookingToStudent failed', bookingId, err);
  }
}
