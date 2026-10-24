// Rapportfil till Transportstyrelsen för riskutbildning. Ren funktion – används i webbläsaren.
import { courseKind } from './courseKind';
import { normalizePersonnummer } from './pnr';

export type Del = 'Teori' | 'Praktik';

export interface ReportElev { personnummer: string | null; name: string }

/** Risk 1 rapporteras som Teori, Risk 2 som Praktik, och Kombo som båda (två filer). */
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
  bookings: { personnummer: string | null; guestName: string | null; attendance?: string; user?: { name: string } | null }[];
}

/** En eller två rapportfiler (Kombo = teori + praktik) för ett kurstillfälle. Uteblivna och sena avanmälningar tas inte med. */
export function sessionReportFiles(s: ReportSession): { filename: string; xml: string }[] {
  const utbDatum = new Date(s.startTime).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const elever = s.bookings
    .filter(b => b.attendance !== 'no_show' && b.attendance !== 'late_cancel')
    .map(b => ({ personnummer: b.personnummer, name: b.guestName || b.user?.name || '' }));
  return reportParts(s.course.type).map(del => ({
    filename: `rapport-${utbDatum}-${del.toLowerCase()}-kurs${s.id}.xml`,
    xml: buildTsReportXml({ bana: s.school.bana, behorighet: s.course.behorighet, del, utbDatum, elever }),
  }));
}
