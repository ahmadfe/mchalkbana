import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { CompanySettings } from './invoices';

/*
 * Fakturan som PDF (A4). Samma innehåll som fakturasidan i admin.
 * Standardtypsnitten klarar å, ä och ö (WinAnsi) – tecken utanför ersätts.
 */

export interface PdfInvoice {
  number: number;
  period: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  buyerName: string;
  buyerEmail: string;
  buyerOrgNr: string;
  buyerAddress: string;
  seller: CompanySettings;
  creditOfNumber?: number | null;
  lines: { date: Date | null; description: string; quantity: number; unitPrice: number; amount: number; students: string }[];
}

const A4 = { w: 595.28, h: 841.89 };
const M = 50; // marginal
const INK = rgb(0.07, 0.09, 0.15);
const GREY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);
const BRAND = rgb(0, 0.77, 0.83);

const tz = { timeZone: 'Europe/Stockholm' } as const;
const ymd = (d: Date) => d.toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', ...tz });
// Svensk talformatering använder specialtecken för minus och mellanrum – byt till vanliga
const plain = (s: string) => s.replace(/−/g, '-').replace(/[  ]/g, ' ');
const money = (n: number) => plain(`${n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`);
const exVat = (n: number) => Math.round((n / 1.25) * 100) / 100;
const periodText = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
};

export async function buildInvoicePdf(inv: PdfInvoice): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const credit = inv.creditOfNumber != null;
  doc.setTitle(`${credit ? 'Kreditfaktura' : 'Faktura'} ${inv.number} – ${inv.seller.name}`);
  doc.setAuthor(inv.seller.name);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Tecken som typsnittet saknar (t.ex. emoji i ett namn) får inte krascha fakturan
  const ok = new Map<string, boolean>();
  const safe = (text: string) => Array.from(text).map(ch => {
    if (!ok.has(ch)) { try { font.encodeText(ch); ok.set(ch, true); } catch { ok.set(ch, false); } }
    return ok.get(ch) ? ch : '?';
  }).join('');

  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;

  const text = (s: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const size = o.size ?? 9.5;
    const f = o.f ?? font;
    const str = safe(s);
    const w = f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: o.right ? x - w : x, y: yy, size, font: f, color: o.color ?? INK });
  };
  const wrap = (s: string, width: number, size: number, f: PDFFont = font) => {
    const out: string[] = [];
    for (const para of s.split('\n').map(safe)) {
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) > width && line) { out.push(line); line = word; } else line = next;
      }
      out.push(line);
    }
    return out;
  };
  const hr = (yy: number, thick = 0.6, color = LINE) => page.drawLine({ start: { x: M, y: yy }, end: { x: A4.w - M, y: yy }, thickness: thick, color });
  const newPageIfNeeded = (need: number) => {
    if (y - need > M + 90) return;
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - M;
  };

  // ── Huvud ──
  const s = inv.seller;
  page.drawRectangle({ x: M, y: y - 4, width: 34, height: 4, color: BRAND });
  y -= 22;
  text(s.name, M, y, { size: 16, f: bold });
  text(credit ? 'KREDITFAKTURA' : 'FAKTURA', A4.w - M, y, { size: 18, f: bold, right: true });
  y -= 15;
  const sellerLines = [...wrap(s.address, 240, 9.5), [s.email, s.phone].filter(Boolean).join('  ·  ')].filter(Boolean);
  const meta: [string, string][] = [
    [credit ? 'Kreditfakturanummer' : 'Fakturanummer', String(inv.number)],
    ['Fakturadatum', ymd(inv.issueDate)],
    ...(credit ? [['Krediterar faktura', String(inv.creditOfNumber)] as [string, string]] : [['Förfallodatum', ymd(inv.dueDate)] as [string, string]]),
  ];
  const top = y;
  for (const l of sellerLines) { text(l, M, y, { color: GREY }); y -= 12.5; }
  let my = top;
  for (const [k, v] of meta) {
    text(k, A4.w - M - 95, my, { color: GREY, right: true });
    text(v, A4.w - M, my, { f: bold, right: true });
    my -= 12.5;
  }
  y = Math.min(y, my) - 18;

  // ── Köpare ──
  const buyer = [inv.buyerName, ...wrap(inv.buyerAddress, 300, 9.5), inv.buyerOrgNr ? `Org.nr ${inv.buyerOrgNr}` : '', inv.buyerEmail].filter(Boolean);
  const boxH = 22 + buyer.length * 12.5;
  page.drawRectangle({ x: M, y: y - boxH + 10, width: A4.w - 2 * M, height: boxH, color: rgb(0.97, 0.98, 0.99) });
  text('FAKTURERAS TILL', M + 12, y - 4, { size: 7.5, f: bold, color: GREY });
  let by = y - 18;
  buyer.forEach((l, i) => { text(l, M + 12, by, { f: i === 0 ? bold : font, color: i === 0 ? INK : GREY }); by -= 12.5; });
  y -= boxH + 14;

  text(credit
    ? `Kreditering av faktura ${inv.creditOfNumber} – riskutbildning, kurser i ${periodText(inv.period)}.`
    : `Riskutbildning för era elever – kurser i ${periodText(inv.period)}.`, M, y, { color: GREY });
  y -= 22;

  // ── Rader ──
  const col = { date: M, desc: M + 68, qty: M + 305, unit: M + 392, amount: A4.w - M };
  const header = () => {
    text('DATUM', col.date, y, { size: 7.5, f: bold, color: GREY });
    text('BESKRIVNING', col.desc, y, { size: 7.5, f: bold, color: GREY });
    text('ANTAL', col.qty, y, { size: 7.5, f: bold, color: GREY, right: true });
    text('À-PRIS EXKL. MOMS', col.unit, y, { size: 7.5, f: bold, color: GREY, right: true });
    text('BELOPP EXKL. MOMS', col.amount, y, { size: 7.5, f: bold, color: GREY, right: true });
    y -= 6;
    hr(y, 1.2, INK);
    y -= 14;
  };
  header();
  for (const l of inv.lines) {
    const names = wrap(l.students.split('\n').filter(Boolean).join(', '), col.qty - col.desc - 40, 8);
    newPageIfNeeded(16 + names.length * 10);
    if (y === A4.h - M) header();
    text(l.date ? ymd(l.date) : '', col.date, y);
    text(l.description, col.desc, y, { f: bold });
    text(String(l.quantity), col.qty, y, { right: true });
    text(money(exVat(l.unitPrice)), col.unit, y, { right: true });
    text(money(exVat(l.amount)), col.amount, y, { right: true });
    y -= 11;
    for (const n of names) { text(n, col.desc, y, { size: 8, color: GREY }); y -= 10; }
    y -= 4;
    hr(y + 6);
    y -= 8;
  }

  // ── Summa ──
  newPageIfNeeded(70);
  const totalEx = exVat(inv.total);
  const vat = Math.round((inv.total - totalEx) * 100) / 100;
  const sx = A4.w - M - 200;
  y -= 4;
  text('Summa exkl. moms', sx, y, { color: GREY }); text(money(totalEx), A4.w - M, y, { right: true }); y -= 13;
  text('Moms 25 %', sx, y, { color: GREY }); text(money(vat), A4.w - M, y, { right: true }); y -= 8;
  page.drawLine({ start: { x: sx, y }, end: { x: A4.w - M, y }, thickness: 1.2, color: INK });
  y -= 15;
  text(credit ? 'Att återbetala' : 'Att betala', sx, y, { size: 12, f: bold });
  text(money(credit ? -inv.total : inv.total), A4.w - M, y, { size: 12, f: bold, right: true });

  // ── Fot: betalning, villkor, företagsuppgifter (på sista sidan) ──
  const fy = M + 58;
  hr(fy + 14);
  const colW = (A4.w - 2 * M) / 3;
  const foot = (x: number, title: string, rows: string[]) => {
    text(title, x, fy, { size: 8, f: bold });
    rows.filter(Boolean).forEach((r, i) => text(r, x, fy - 11 - i * 10, { size: 8, color: GREY }));
  };
  foot(M, 'Betalning', credit
    ? ['Beloppet dras av från kommande', 'faktura eller betalas tillbaka.']
    : [s.bankgiro && `Bankgiro ${s.bankgiro}`, s.plusgiro && `Plusgiro ${s.plusgiro}`, s.iban && `IBAN ${s.iban}`, `Referens: fakturanummer ${inv.number}`]);
  foot(M + colW, 'Villkor', credit ? [] : [`${s.paymentDays} dagar netto`, 'Dröjsmålsränta enligt räntelagen']);
  foot(M + 2 * colW, s.name, [s.orgNr && `Org.nr ${s.orgNr}`, s.vatNr && `Momsreg.nr ${s.vatNr}`, s.fSkatt !== false ? 'Godkänd för F-skatt' : '']);

  const pages = doc.getPages();
  if (pages.length > 1) pages.forEach((p, i) => p.drawText(`Sida ${i + 1} av ${pages.length}`, { x: A4.w - M - 50, y: M - 20, size: 7.5, font, color: GREY }));

  return doc.save();
}
