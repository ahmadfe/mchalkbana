import { prisma } from './db';
import { getCompany } from './invoices';

/*
 * SIE 4-fil med fakturorna (och betalningarna) för en period, för import i
 * bokföringsprogram som Fortnox och Visma. Filformatet ska vara PC8 (kodsida 437).
 *
 * Faktura:        1510 Kundfordringar D / 3001 Försäljning K / 2611 Utgående moms K
 * Kreditfaktura:  samma konton med omvända tecken
 * Betalning:      1930 Bank D / 1510 Kundfordringar K
 */

export interface SieAccounts {
  receivable: string;
  sales: string;
  vat: string;
  bank: string;
}

export const DEFAULT_ACCOUNTS: SieAccounts = { receivable: '1510', sales: '3001', vat: '2611', bank: '1930' };

const ACCOUNT_NAMES: Record<keyof SieAccounts, string> = {
  receivable: 'Kundfordringar',
  sales: 'Försäljning inom Sverige, 25 % moms',
  vat: 'Utgående moms på försäljning inom Sverige, 25 %',
  bank: 'Företagskonto',
};

// Kodsida 437 för de tecken utanför ASCII som kan förekomma i svenska namn
const CP437: Record<string, number> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, å: 0x86, ç: 0x87, ê: 0x88, ë: 0x89, è: 0x8a, ï: 0x8b, î: 0x8c,
  ì: 0x8d, Ä: 0x8e, Å: 0x8f, É: 0x90, æ: 0x91, Æ: 0x92, ô: 0x93, ö: 0x94, ò: 0x95, û: 0x96, ù: 0x97, ÿ: 0x98, Ö: 0x99,
  Ü: 0x9a, ø: 0x9b, Ø: 0x9d, á: 0xa0, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5,
};

function toPc8(text: string): Buffer {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (ch.length === 1 && code < 0x80) bytes.push(code);
    else bytes.push(CP437[ch] ?? 0x3f); // '?'
  }
  return Buffer.from(bytes);
}

const q = (s: string) => `"${s.replace(/["\\]/g, '').replace(/[\r\n]+/g, ' ')}"`;
const amount = (n: number) => n.toFixed(2);
const tz = { timeZone: 'Europe/Stockholm' } as const;
const ymd = (d: Date) => d.toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', ...tz }).replace(/-/g, '');
const exVat = (total: number) => Math.round((total / 1.25) * 100) / 100;

/** Perioden anges som månader "2026-11" – "2026-12" (båda inklusive). */
export async function buildSie(from: string, to: string, opts: { payments: boolean }): Promise<{ file: Buffer; filename: string; count: number }> {
  const company = await getCompany();
  const accounts: SieAccounts = { ...DEFAULT_ACCOUNTS, ...company.sieAccounts };
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  // Svensk tid: ta med marginal och filtrera på datum nedan
  const start = new Date(Date.UTC(fy, fm - 1, 1) - 2 * 3600_000);
  const end = new Date(Date.UTC(ty, tm, 1) + 2 * 3600_000);
  const inRange = (d: Date) => { const s = ymd(d).slice(0, 6); return s >= `${fy}${String(fm).padStart(2, '0')}` && s <= `${ty}${String(tm).padStart(2, '0')}`; };

  const [invoices, paid] = await Promise.all([
    prisma.invoice.findMany({ where: { status: { not: 'created' }, issueDate: { gte: start, lt: end } }, orderBy: { issueDate: 'asc' } }),
    opts.payments
      ? prisma.invoice.findMany({ where: { paidAt: { gte: start, lt: end }, creditOfId: null }, orderBy: { paidAt: 'asc' } })
      : Promise.resolve([]),
  ]);

  const lines: string[] = [
    '#FLAGGA 0',
    `#PROGRAM ${q(company.name)} 1.0`,
    '#FORMAT PC8',
    `#GEN ${ymd(new Date())}`,
    '#SIETYP 4',
    `#FNAMN ${q(company.name)}`,
    ...(company.orgNr ? [`#ORGNR ${company.orgNr}`] : []),
    `#RAR 0 ${fy}0101 ${fy}1231`,
    '#VALUTA SEK',
    ...(Object.keys(ACCOUNT_NAMES) as (keyof SieAccounts)[]).map(k => `#KONTO ${accounts[k]} ${q(ACCOUNT_NAMES[k])}`),
  ];

  let count = 0;
  for (const inv of invoices.filter(i => inRange(i.issueDate))) {
    const total = inv.total; // negativ för kreditfakturor
    const net = exVat(total);
    const vat = Math.round((total - net) * 100) / 100;
    const kind = inv.creditOfId ? 'Kreditfaktura' : 'Faktura';
    lines.push(`#VER "" "" ${ymd(inv.issueDate)} ${q(`${kind} ${inv.number} ${inv.buyerName}`)}`, '{');
    lines.push(`   #TRANS ${accounts.receivable} {} ${amount(total)}`);
    lines.push(`   #TRANS ${accounts.sales} {} ${amount(-net)}`);
    lines.push(`   #TRANS ${accounts.vat} {} ${amount(-vat)}`);
    lines.push('}');
    count++;
  }
  for (const inv of paid.filter(i => i.paidAt && inRange(i.paidAt))) {
    lines.push(`#VER "" "" ${ymd(inv.paidAt!)} ${q(`Betalning faktura ${inv.number} ${inv.buyerName}`)}`, '{');
    lines.push(`   #TRANS ${accounts.bank} {} ${amount(inv.total)}`);
    lines.push(`   #TRANS ${accounts.receivable} {} ${amount(-inv.total)}`);
    lines.push('}');
    count++;
  }

  return {
    file: toPc8(lines.join('\r\n') + '\r\n'),
    filename: `Fakturor_${from}${to !== from ? `_${to}` : ''}.se`,
    count,
  };
}
