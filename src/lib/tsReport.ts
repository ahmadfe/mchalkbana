// Rapportfil till Transportstyrelsen för riskutbildning. Ren funktion – används i webbläsaren.
import { bookingParts, courseKind } from './courseKind';
import { normalizePersonnummer } from './pnr';

export type Del = 'Teori' | 'Praktik';

export interface ReportElev { personnummer: string | null; name: string }

/** Risk 1 rapporteras som Teori, Risk 2 som Praktik, och Kombo som båda (två filer). */
export const DEL_PART: Record<Del, 'risk1' | 'risk2'> = { Teori: 'risk1', Praktik: 'risk2' };
export const DEL_LABEL: Record<Del, string> = { Teori: 'Risk 1 (Teori)', Praktik: 'Risk 2 (Praktik)' };

export function reportParts(courseType: string): Del[] {
  const kind = courseKind(courseType);
  if (kind === 'kombo') return ['Teori', 'Praktik'];
  if (kind === 'risk1') return ['Teori'];
  return ['Praktik'];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Elever utan giltigt personnummer hoppas över – de går inte att rapportera. */
export function buildTsReportXml(opts: { bana: string; behorighet: string; del: Del; utbDatum: string; elever: ReportElev[] }): string {
  const rows = opts.elever.flatMap(e => {
    const pnr = normalizePersonnummer(e.personnummer);
    if (!pnr) return [];
    return [
      '   <Elev>',
      `      <PersonNr>${pnr}</PersonNr>`,
      ...(e.name.trim() ? [`      <Namn>${esc(e.name.trim())}</Namn>`] : []),
      `      <UtbDatum>${opts.utbDatum}</UtbDatum>`,
      '   </Elev>',
    ];
  });
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Rapport>',
    `   <Bana>${esc(opts.bana)}</Bana>`,
    `   <Behorighet>${esc(opts.behorighet || 'B')}</Behorighet>`,
    `   <Del>${opts.del}</Del>`,
    ...rows,
    '</Rapport>',
    '',
  ].join('\n');
}

export interface ReportSession {
  id: number;
  startTime: Date | string;
  course: { type: string; behorighet: string };
  school: { bana: string; name: string };
  bookings: { personnummer: string | null; guestName: string | null; attendance?: string; comboParts?: string | null; user?: { name: string } | null }[];
}

/** Elever som ska med i en dels rapport: inte uteblivna/sena avanmälningar, och på kombokurser bara de som gör delen. */
export function reportBookings<T extends { attendance?: string; comboParts?: string | null }>(courseType: string, del: Del, bookings: T[]): T[] {
  return bookings.filter(b => b.attendance !== 'no_show' && b.attendance !== 'late_cancel' && bookingParts(courseType, b.comboParts).includes(DEL_PART[del]));
}

/** En eller två rapportfiler (Kombo = teori + praktik) för ett kurstillfälle. */
export function sessionReportFiles(s: ReportSession): { filename: string; xml: string }[] {
  const utbDatum = new Date(s.startTime).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  return reportParts(s.course.type).map(del => {
    const elever = reportBookings(s.course.type, del, s.bookings).map(b => ({ personnummer: b.personnummer, name: b.guestName || b.user?.name || '' }));
    return {
      filename: `rapport-${utbDatum}-${del.toLowerCase()}-kurs${s.id}.xml`,
      xml: buildTsReportXml({ bana: s.school.bana, behorighet: s.course.behorighet, del, utbDatum, elever }),
    };
  });
}
