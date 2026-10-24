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
