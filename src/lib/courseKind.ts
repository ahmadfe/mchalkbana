export type CourseKind = 'risk1' | 'risk2' | 'kombo' | 'other';

/** Kurstyperna i databasen är fritext ("Risk 2", "Risk2", "Kombo " ...). */
export function courseKind(type: string): CourseKind {
  const t = type.toLowerCase().replace(/\s+/g, '');
  if (t.startsWith('kombo') || t.includes('1+2')) return 'kombo';
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
