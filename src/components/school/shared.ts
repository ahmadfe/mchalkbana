import type { Session } from '@/lib/types';
import type { CourseKind } from '@/lib/courseKind';

export interface SchoolBooking {
  id: number;
  guestName: string | null;
  personnummer: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  note: string | null;
  status: string;
  bookingTime: string;
  session: Session & { course: { titleSv: string; titleEn: string } };
}

export interface Reservation { meetingPlace: string; fillBy: string | null; message: string; released: boolean }

export interface SchoolInvoice { id: number; number: number; period: string; status: string; issueDate: string; dueDate: string; total: number; paidAt: string | null; creditOfId: number | null }

export interface SchoolPrice { courseId: number; title: string; part: string; kombo: boolean; price: number; listPrice: number }

/** Allt som behövs för att visa ett pass – i listan och i detaljvyn. */
export interface PassItem {
  id: number;
  session: Session;
  title: string;
  start: Date;
  end: Date;
  students: SchoolBooking[];
  meetingPlace: string;
  /** Arkiverade pass går inte att ändra */
  readOnly: boolean;
  myAllocation: number | null;
  remaining: number;
  full: boolean;
  deadlinePassed: boolean;
  locked: boolean;
  reservation: Reservation | null;
  price?: number;
  customPrice: boolean;
}

export const tz = { timeZone: 'Europe/Stockholm' } as const;
export const hm = (d: Date) => d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });
export const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`;
export const dateLabel = (iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(iso).toLocaleDateString('sv-SE', { ...tz, ...opts });
export const monthLabel = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
};

export const KIND: Record<CourseKind, { label: string; cls: string }> = {
  risk1: { label: 'R1', cls: 'bg-sky-500/15 text-sky-300' },
  risk2: { label: 'R2', cls: 'bg-orange-500/15 text-orange-300' },
  kombo: { label: 'R1+2', cls: 'bg-purple-500/15 text-purple-300' },
  other: { label: 'Kurs', cls: 'bg-white/10 text-white/70' },
};

export function invoiceStatus(i: SchoolInvoice): { label: string; tone: 'neutral' | 'green' | 'amber' | 'red' } {
  if (i.creditOfId) return { label: 'Kreditfaktura', tone: 'neutral' };
  if (i.status === 'paid') return { label: 'Betald', tone: 'green' };
  if (i.status === 'credited') return { label: 'Krediterad', tone: 'neutral' };
  return new Date(i.dueDate) < new Date() ? { label: 'Förfallen', tone: 'red' } : { label: 'Obetald', tone: 'amber' };
}

/** Obetalda fakturor (skickade, inte betalda/krediterade). */
export const unpaidInvoices = (list: SchoolInvoice[]) => list.filter(i => !i.creditOfId && i.status === 'sent');

export function buildPasses(sessions: Session[], bookings: SchoolBooking[], priceMap: Record<number, number>, locale: string) {
  const bySession = bookings.reduce<Record<number, SchoolBooking[]>>((acc, b) => {
    (acc[b.session.id] ??= []).push(b);
    return acc;
  }, {});
  const titleOf = (s: Session) => (locale === 'sv' ? s.course?.titleSv : s.course?.titleEn) ?? '';

  const upcoming: PassItem[] = sessions.map((s) => {
    const list = bySession[s.id] || [];
    const myAllocation = (s as { myAllocation?: number | null }).myAllocation ?? null;
    const reservation = (s as { myReservation?: Reservation | null }).myReservation ?? null;
    const full = myAllocation !== null ? list.length >= myAllocation : s.seatsAvailable === 0;
    // Efter "fyll senast" kan skolan inte lägga till fler elever
    const deadlinePassed = !!reservation && (reservation.released || (!!reservation.fillBy && new Date(reservation.fillBy) < new Date()));
    const custom = s.course?.id !== undefined ? priceMap[s.course.id] : undefined;
    return {
      id: s.id, session: s, title: titleOf(s), start: new Date(s.startTime), end: new Date(s.endTime), students: list,
      meetingPlace: reservation?.meetingPlace || s.meetingPlace || s.course?.location || s.school?.name || '',
      readOnly: false, myAllocation, remaining: myAllocation !== null ? myAllocation - list.length : s.seatsAvailable,
      full, deadlinePassed, locked: full || deadlinePassed, reservation,
      price: custom ?? s.course?.price, customPrice: custom !== undefined,
    };
  });

  // Arkiverade pass = pass där skolan har elever och som redan har börjat. De går inte att ändra.
  const archived: PassItem[] = Object.values(bySession)
    .filter((list) => new Date(list[0].session.startTime) <= new Date())
    .map((list) => {
      const s = list[0].session;
      return {
        id: s.id, session: s, title: titleOf(s), start: new Date(s.startTime), end: new Date(s.endTime), students: list,
        meetingPlace: s.meetingPlace || s.course?.location || s.school?.name || '',
        readOnly: true, myAllocation: null, remaining: 0, full: false, deadlinePassed: false, locked: true, reservation: null, customPrice: false,
      };
    })
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  return { upcoming, archived };
}
