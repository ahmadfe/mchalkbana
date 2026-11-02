export type CourseKind = 'risk1' | 'risk2' | 'kombo' | 'other';

/** Kurstyperna i databasen är fritext ("Risk 2", "Risk2", "Kombo " ...). */
export function courseKind(type: string): CourseKind {
  const t = type.toLowerCase().replace(/\s+/g, '');
  if (t.startsWith('kombo') || t.startsWith('combo') || t.includes('1+2')) return 'kombo';
  if (t.includes('risk1')) return 'risk1';
  if (t.includes('risk2') || t.includes('halka')) return 'risk2';
  return 'other';
}

export const COURSE_KIND_LABEL: Record<CourseKind, string> = {
  risk1: 'Risk 1',
  risk2: 'Risk 2',
  kombo: 'Risk 1+2',
  other: 'Övrigt',
};

/** Kombokurs: vilka delar eleven gör. Andra kurser har alltid sin enda del. */
export type ComboParts = 'both' | 'risk1' | 'risk2';
export const COMBO_PARTS: ComboParts[] = ['both', 'risk1', 'risk2'];
export const COMBO_PARTS_LABEL: Record<ComboParts, string> = { both: 'Risk 1 + 2', risk1: 'Bara Risk 1', risk2: 'Bara Risk 2' };

export const isComboParts = (v: unknown): v is ComboParts => typeof v === 'string' && (COMBO_PARTS as string[]).includes(v);

/** Riskdelarna en bokning omfattar, t.ex. ['risk1', 'risk2'] för en hel kombokurs. */
export function bookingParts(courseType: string, comboParts: string | null | undefined): ('risk1' | 'risk2')[] {
  const kind = courseKind(courseType);
  if (kind === 'risk1') return ['risk1'];
  if (kind === 'risk2') return ['risk2'];
  if (kind !== 'kombo') return [];
  if (comboParts === 'risk1') return ['risk1'];
  if (comboParts === 'risk2') return ['risk2'];
  return ['risk1', 'risk2'];
}

/** Kortnamn för en bokning: "Risk 1+2", "Bara Risk 2" på kombokurser, annars kurstypen. */
export function bookingKindLabel(courseType: string, comboParts: string | null | undefined): string {
  const kind = courseKind(courseType);
  if (kind === 'kombo' && (comboParts === 'risk1' || comboParts === 'risk2')) return COMBO_PARTS_LABEL[comboParts];
  return COURSE_KIND_LABEL[kind];
}
