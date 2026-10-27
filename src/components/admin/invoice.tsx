import { Badge } from './ui';

export const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`;

export const periodLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Fakturans status som etikett: förfallen räknas fram från sista betalningsdag. */
export function InvoiceStatus({ inv }: { inv: { status: string; dueDate: string; creditOfId?: number | null } }) {
  if (inv.creditOfId) return <Badge>{inv.status === 'created' ? 'Kreditfaktura, ej skickad' : 'Kreditfaktura'}</Badge>;
  if (inv.status === 'paid') return <Badge tone="green">Betald</Badge>;
  if (inv.status === 'credited') return <Badge>Krediterad</Badge>;
  if (inv.status === 'created') return <Badge tone="blue">Ej skickad</Badge>;
  return new Date(inv.dueDate) < new Date() ? <Badge tone="red">Förfallen</Badge> : <Badge tone="amber">Obetald</Badge>;
}
