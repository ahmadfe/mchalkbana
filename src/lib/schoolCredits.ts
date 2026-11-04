import { prisma } from './db';
import { CREDIT_METHOD_LABEL } from './schoolCreditLabels';

export { CREDIT_METHOD_LABEL, CREDIT_METHODS } from './schoolCreditLabels';

/**
 * Skolans saldo: pengar vi redan fått för skolans räkning.
 * - Med bokning: skoleleven betalade en del själv på kursen → dras av på fakturan där eleven finns.
 * - Utan bokning: tillgodo som admin lagt in på skolans sida → dras av på skolans nästa faktura.
 * Hela beloppet dras av (även om det är mer än elevens pris), men aldrig mer än fakturans summa –
 * resten ligger kvar som tillgodo till nästa faktura.
 */

export interface DraftDeduction {
  creditId: number;
  date: string;
  description: string;
  student: string;
  /** Det som dras av på den här fakturan (kan vara mindre än tillgodot) */
  amount: number;
  /** Hela tillgodots belopp */
  full: number;
}

type CreditRow = {
  id: number; bookingId: number | null; amount: number; method: string; note: string; createdAt: Date;
  booking: { status: string; bookedBySchoolUserId: number | null; guestName: string | null; personnummer: string | null } | null;
};

const studentName = (c: CreditRow) => c.booking?.guestName || c.booking?.personnummer || (c.bookingId ? `Bokning #${c.bookingId}` : '');

export function creditDescription(c: Pick<CreditRow, 'bookingId' | 'method' | 'note'>) {
  const how = CREDIT_METHOD_LABEL[c.method];
  return c.bookingId
    ? `Avgår: betalt direkt av eleven${how ? ` (${how})` : ''}`
    : `Avgår: tillgodo${c.note ? ` – ${c.note}` : ''}`;
}

/** Oanvända tillgodon per skola (äldst först) */
export async function unusedCredits(schoolUserIds: number[]) {
  if (schoolUserIds.length === 0) return new Map<number, CreditRow[]>();
  const rows = await prisma.schoolCredit.findMany({
    where: { schoolUserId: { in: schoolUserIds }, invoiceId: null },
    select: {
      id: true, schoolUserId: true, bookingId: true, amount: true, method: true, note: true, createdAt: true,
      booking: { select: { status: true, bookedBySchoolUserId: true, guestName: true, personnummer: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const map = new Map<number, CreditRow[]>();
  for (const r of rows) map.set(r.schoolUserId, [...(map.get(r.schoolUserId) ?? []), r]);
  return map;
}

/**
 * Väljer vilka tillgodon som dras av på en faktura med de här bokningarna.
 * Elevbetalningar på fakturans elever först, sedan allmänt tillgodo. Tar bort de använda ur `pool`.
 * En elevbetalning vars bokning är avbokad eller inte längre hör till skolan räknas som allmänt tillgodo.
 */
export function pickDeductions(pool: CreditRow[], schoolUserId: number, bookingIds: Set<number>, gross: number): DraftDeduction[] {
  const isGeneral = (c: CreditRow) => !c.bookingId || !c.booking || c.booking.status === 'Canceled' || c.booking.bookedBySchoolUserId !== schoolUserId;
  const ordered = [
    ...pool.filter(c => c.bookingId && bookingIds.has(c.bookingId) && !isGeneral(c)),
    ...pool.filter(isGeneral),
  ];
  const out: DraftDeduction[] = [];
  let left = gross;
  for (const c of ordered) {
    if (left <= 0) break;
    const amount = Math.min(c.amount, left);
    left -= amount;
    out.push({ creditId: c.id, date: c.createdAt.toISOString(), description: creditDescription(c), student: studentName(c), amount, full: c.amount });
    pool.splice(pool.indexOf(c), 1);
  }
  return out;
}
