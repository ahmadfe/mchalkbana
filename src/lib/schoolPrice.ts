import { courseKind } from './courseKind';

/**
 * Skolans pris för en elev (kr inkl. moms), eller null om skolan saknar pris.
 * Kombokurs: priset för elevens delar (Risk 1 + 2 / bara Risk 1 / bara Risk 2).
 * Saknas "bara Risk 1/2" används skolans pris för en vanlig Risk 1/2-kurs med samma behörighet.
 */

export interface SchoolPriceRow { courseId: number; part: string; price: number }
export interface PriceCourse { id: number; type: string; behorighet: string }

export function schoolPriceFor(
  prices: SchoolPriceRow[],
  course: PriceCourse,
  comboParts: string | null | undefined,
  courses: PriceCourse[],
): number | null {
  if (courseKind(course.type) !== 'kombo') return prices.find(p => p.courseId === course.id && p.part === 'both')?.price ?? null;

  const part = comboParts === 'risk1' || comboParts === 'risk2' ? comboParts : 'both';
  const exact = prices.find(p => p.courseId === course.id && p.part === part);
  if (exact) return exact.price;
  if (part === 'both') return null;
  // Samma del som vanlig kurs, t.ex. skolans pris för "Riskutbildning Del 2 BIL"
  const single = prices
    .filter(p => p.part === 'both')
    .filter(p => {
      const c = courses.find(x => x.id === p.courseId);
      return c && courseKind(c.type) === part && c.behorighet === course.behorighet;
    })
    .map(p => p.price);
  return single.length ? Math.min(...single) : null;
}
