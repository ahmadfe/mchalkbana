import { prisma } from './db';

/*
 * Fakturor till trafikskolor.
 * Underlag: skolans bokningar på kurser som har hållits, grupperade per kursmånad.
 * Avbokade bokningar faktureras inte; uteblivna och sena avbokningar gör det.
 * Priserna är inkl. 25 % moms, som i resten av systemet.
 */

export const VAT_RATE = 0.25;

export interface CompanySettings {
  name: string;
  address: string;
  orgNr: string;
  vatNr: string;
  bankgiro: string;
  plusgiro: string;
  iban: string;
  email: string;
  phone: string;
  paymentDays: number;
  firstNumber: number;
  fSkatt: boolean;
  /** Kurser före den här månaden räknas som redan fakturerade (det gamla e-postflödet) */
  startPeriod: string;
}

const SETTINGS_KEY = 'invoice_company';

export const DEFAULT_COMPANY: CompanySettings = {
  name: 'Uppsala Halkbana',
  address: 'Norrlövsta 147, 747 91 Alunda',
  orgNr: '',
  vatNr: '',
  bankgiro: '',
  plusgiro: '',
  iban: '',
  email: 'info@uppsalahalkbana.se',
  phone: '07 07 66 66 61',
  paymentDays: 30,
  firstNumber: 1001,
  fSkatt: true,
  startPeriod: '2026-11',
};

export async function getCompany(): Promise<CompanySettings> {
  const row = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return DEFAULT_COMPANY;
  try {
    return { ...DEFAULT_COMPANY, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_COMPANY;
  }
}

export function parseCompany(body: Record<string, unknown>): { error: string } | { data: CompanySettings } {
  const str = (k: keyof CompanySettings) => String(body[k] ?? '').trim();
  const paymentDays = Number(body.paymentDays);
  const firstNumber = Number(body.firstNumber);
  if (!str('name')) return { error: 'Ange företagsnamn' };
  if (!Number.isInteger(paymentDays) || paymentDays < 0 || paymentDays > 120) return { error: 'Betalningsvillkor måste vara 0–120 dagar' };
  if (!Number.isInteger(firstNumber) || firstNumber < 1) return { error: 'Ogiltigt första fakturanummer' };
  if (!/^\d{4}-\d{2}$/.test(str('startPeriod'))) return { error: 'Ange månad som ÅÅÅÅ-MM' };
  return {
    data: {
      name: str('name'), address: str('address'), orgNr: str('orgNr'), vatNr: str('vatNr'),
      bankgiro: str('bankgiro'), plusgiro: str('plusgiro'), iban: str('iban'),
      email: str('email'), phone: str('phone'), paymentDays, firstNumber, fSkatt: body.fSkatt !== false, startPeriod: str('startPeriod'),
    },
  };
}

export async function saveCompany(data: CompanySettings): Promise<void> {
  const value = JSON.stringify(data);
  await prisma.settings.upsert({ where: { key: SETTINGS_KEY }, update: { value }, create: { key: SETTINGS_KEY, value } });
}

/** Uppgifter som en faktura måste ha innan den skickas. */
export function missingCompanyFields(c: CompanySettings): string[] {
  const missing: string[] = [];
  if (!c.orgNr) missing.push('organisationsnummer');
  if (!c.vatNr) missing.push('momsregistreringsnummer');
  if (!c.bankgiro && !c.plusgiro && !c.iban) missing.push('bankgiro (eller plusgiro/IBAN)');
  if (!c.address) missing.push('adress');
  return missing;
}

export function splitVat(total: number) {
  const exVat = Math.round(total / (1 + VAT_RATE));
  return { exVat, vat: total - exVat };
}

const tz = { timeZone: 'Europe/Stockholm' } as const;
/** "2026-11" för en tidpunkt, i svensk tid */
export const periodOf = (d: Date) => d.toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', ...tz }).slice(0, 7);
export const periodLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export interface DraftLine {
  sessionId: number;
  date: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  students: string[];
  bookingIds: number[];
}

export interface Draft {
  schoolUserId: number;
  schoolName: string;
  email: string;
  period: string;
  lines: DraftLine[];
  total: number;
  students: number;
}

/** Skolornas ofakturerade bokningar på hållna kurser, en utkastfaktura per skola och månad. */
export async function getDrafts(opts: { schoolUserId?: number; period?: string } = {}): Promise<Draft[]> {
  const company = await getCompany();
  const [y, m] = company.startPeriod.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1) - 2 * 3600_000); // marginal för svensk tid; filtreras nedan

  const bookings = await prisma.booking.findMany({
    where: {
      bookedBySchoolUserId: opts.schoolUserId ?? { not: null },
      invoiceId: null,
      status: { not: 'Canceled' },
      session: { startTime: { gte: from, lt: new Date() }, status: { not: 'canceled' } },
    },
    include: {
      session: { select: { id: true, startTime: true, courseId: true, course: { select: { titleSv: true, price: true } } } },
      bookedBySchoolUser: { select: { id: true, name: true, email: true, schoolCoursePrices: { select: { courseId: true, price: true } } } },
    },
    orderBy: { session: { startTime: 'asc' } },
  });

  const drafts = new Map<string, Draft>();
  for (const b of bookings) {
    const school = b.bookedBySchoolUser!;
    const period = periodOf(b.session.startTime);
    if (period < company.startPeriod) continue;
    if (opts.period && period !== opts.period) continue;
    const key = `${school.id}|${period}`;
    let d = drafts.get(key);
    if (!d) {
      d = { schoolUserId: school.id, schoolName: school.name, email: school.email, period, lines: [], total: 0, students: 0 };
      drafts.set(key, d);
    }
    const unitPrice = school.schoolCoursePrices.find(p => p.courseId === b.session.courseId)?.price ?? b.session.course.price;
    let line = d.lines.find(l => l.sessionId === b.session.id && l.unitPrice === unitPrice);
    if (!line) {
      line = {
        sessionId: b.session.id,
        date: b.session.startTime.toISOString(),
        description: b.session.course.titleSv,
        quantity: 0, unitPrice, amount: 0, students: [], bookingIds: [],
      };
      d.lines.push(line);
    }
    line.quantity++;
    line.amount += unitPrice;
    line.students.push(b.guestName || b.personnummer || `Bokning #${b.id}`);
    line.bookingIds.push(b.id);
    d.total += unitPrice;
    d.students++;
  }
  return Array.from(drafts.values()).sort((a, b) => a.period.localeCompare(b.period) || a.schoolName.localeCompare(b.schoolName, 'sv'));
}

/** Skapar fakturan för en skola och månad: fakturanummer, rader och kopplade bokningar. */
export async function createInvoice(schoolUserId: number, period: string): Promise<{ error: string } | { id: number }> {
  const [draft] = await getDrafts({ schoolUserId, period });
  if (!draft || draft.lines.length === 0) return { error: 'Det finns inget att fakturera för den här skolan och månaden' };

  const company = await getCompany();
  const school = await prisma.user.findUnique({ where: { id: schoolUserId }, select: { name: true, email: true, orgNr: true, billingAddress: true } });
  if (!school) return { error: 'Skolan hittades inte' };

  const issueDate = new Date();
  const dueDate = new Date(issueDate.getTime() + company.paymentDays * 86400_000);
  const { vat } = splitVat(draft.total);
  const bookingIds = draft.lines.flatMap(l => l.bookingIds);

  // Fakturanumret är unikt – försök igen om två fakturor skapas samtidigt
  for (let attempt = 0; attempt < 3; attempt++) {
    const max = await prisma.invoice.aggregate({ _max: { number: true } });
    const number = Math.max(company.firstNumber, (max._max.number ?? 0) + 1);
    try {
      const invoice = await prisma.$transaction(async tx => {
        // Bokningarna får inte ha hunnit faktureras av någon annan
        const taken = await tx.booking.count({ where: { id: { in: bookingIds }, invoiceId: { not: null } } });
        if (taken > 0) throw new Error('ALREADY_INVOICED');
        const inv = await tx.invoice.create({
          data: {
            number, schoolUserId, period, issueDate, dueDate, total: draft.total, vat,
            buyerName: school.name, buyerEmail: school.email, buyerOrgNr: school.orgNr, buyerAddress: school.billingAddress,
            seller: JSON.stringify(company),
            lines: {
              create: draft.lines.map(l => ({
                sessionId: l.sessionId, date: new Date(l.date), description: l.description,
                quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount, students: l.students.join('\n'),
              })),
            },
          },
        });
        await tx.booking.updateMany({ where: { id: { in: bookingIds } }, data: { invoiceId: inv.id } });
        return inv;
      });
      return { id: invoice.id };
    } catch (e) {
      if (e instanceof Error && e.message === 'ALREADY_INVOICED') return { error: 'Några av bokningarna har redan fakturerats – ladda om sidan' };
      if ((e as { code?: string }).code === 'P2002') continue; // fakturanumret togs precis
      throw e;
    }
  }
  return { error: 'Kunde inte skapa fakturanummer, försök igen' };
}

export type InvoiceAction = 'sent' | 'paid' | 'unpaid' | 'delete';

/**
 * Status: skapad → skickad → betald. "delete" gäller bara fakturor som inte skickats –
 * bokningarna blir då ofakturerade igen. Skickade fakturor krediteras i stället (steg 2).
 */
export async function updateInvoice(id: number, action: InvoiceAction): Promise<{ error: string } | { ok: true }> {
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return { error: 'Fakturan hittades inte' };
  switch (action) {
    case 'sent':
      if (inv.status !== 'created') return { error: 'Fakturan är redan skickad' };
      await prisma.invoice.update({ where: { id }, data: { status: 'sent', sentAt: new Date() } });
      return { ok: true };
    case 'paid':
      if (inv.status === 'credited') return { error: 'Fakturan är krediterad' };
      await prisma.invoice.update({ where: { id }, data: { status: 'paid', paidAt: new Date(), sentAt: inv.sentAt ?? new Date() } });
      return { ok: true };
    case 'unpaid':
      if (inv.status !== 'paid') return { error: 'Fakturan är inte markerad som betald' };
      await prisma.invoice.update({ where: { id }, data: { status: 'sent', paidAt: null } });
      return { ok: true };
    case 'delete':
      if (inv.status !== 'created') return { error: 'En skickad faktura kan inte tas bort – kreditera den i stället' };
      await prisma.$transaction([
        prisma.booking.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } }),
        prisma.invoice.delete({ where: { id } }),
      ]);
      return { ok: true };
  }
}

/** Siffrorna överst på fakturasidan. */
export async function invoiceStats(drafts: Draft[]) {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86400_000);
  const [unpaid, overdue, paid] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: 'sent' }, _sum: { total: true }, _count: true }),
    prisma.invoice.aggregate({ where: { status: 'sent', dueDate: { lt: now } }, _sum: { total: true }, _count: true }),
    prisma.invoice.aggregate({ where: { status: 'paid', paidAt: { gte: monthAgo } }, _sum: { total: true }, _count: true }),
  ]);
  const toInvoice = drafts.reduce((s, d) => s + d.total, 0);
  return {
    toInvoiceExVat: splitVat(toInvoice).exVat,
    toInvoiceSeats: drafts.reduce((s, d) => s + d.students, 0),
    unpaid: unpaid._sum.total ?? 0,
    unpaidCount: unpaid._count,
    overdue: overdue._sum.total ?? 0,
    overdueCount: overdue._count,
    paid30: paid._sum.total ?? 0,
  };
}
