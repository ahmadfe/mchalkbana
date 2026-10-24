// Personnummer-hjälp utan kryptering – går att använda i webbläsaren.

/** Returnerar 12 siffror (ÅÅÅÅMMDDXXXX) eller null om det inte går att tolka. */
export function normalizePersonnummer(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 12) return digits;
  if (digits.length !== 10) return null;
  const yy = parseInt(digits.slice(0, 2), 10);
  const currentYY = new Date().getFullYear() % 100;
  let century = yy <= currentYY ? 2000 : 1900;
  if (trimmed.includes('+')) century -= 100;
  return String(century / 100) + digits;
}

export function formatPersonnummer(pnr12: string): string {
  return `${pnr12.slice(0, 8)}-${pnr12.slice(8)}`;
}

export function ageFromPersonnummer(pnr12: string, at = new Date()): number | null {
  const y = +pnr12.slice(0, 4), m = +pnr12.slice(4, 6), d = +pnr12.slice(6, 8) % 60; // samordningsnummer: dag + 60
  if (!y || !m || !d) return null;
  let age = at.getFullYear() - y;
  if (at.getMonth() + 1 < m || (at.getMonth() + 1 === m && at.getDate() < d)) age--;
  return age;
}
