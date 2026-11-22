'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Calendar, FileText, Home, LogOut, Menu, Tag, Users, X, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { InstallAppButton } from '@/components/pwa';
import { PortalThemeRoot, ThemeToggle } from '@/components/PortalTheme';
import type { Session } from '@/lib/types';
import type { SchoolBooking, SchoolInvoice, SchoolPrice } from './shared';

interface SchoolData {
  sessions: Session[];
  bookings: SchoolBooking[];
  priceMap: Record<number, number>;
  prices: SchoolPrice[];
  invoices: SchoolInvoice[];
  reload: () => Promise<void>;
}

const Ctx = createContext<SchoolData | null>(null);

/** Skolans data – laddas en gång för alla sidor i skolportalen. */
export function useSchool() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSchool utanför SchoolShell');
  return v;
}

const NAV: { href: string; label: string; icon: LucideIcon; /** färg i ljust tema */ ic: string }[] = [
  { href: '/school', label: 'Översikt', icon: Home, ic: 'blue' },
  { href: '/school/pass', label: 'Pass', icon: Calendar, ic: 'emerald' },
  { href: '/school/elever', label: 'Elever', icon: Users, ic: 'violet' },
  { href: '/school/fakturor', label: 'Fakturor', icon: FileText, ic: 'amber' },
  { href: '/school/priser', label: 'Priser', icon: Tag, ic: 'pink' },
];

export default function SchoolShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Omit<SchoolData, 'reload'> | null>(null);

  const reload = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const get = (url: string): Promise<any> => fetch(url).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
    const [s, b, p, f] = await Promise.all([
      get('/api/sessions?includeSchool=true'),
      get('/api/school/bookings'),
      get('/api/school/prices'),
      get('/api/school/fakturor'),
    ]);
    setData({
      sessions: s.sessions ?? [],
      bookings: b.bookings ?? [],
      priceMap: p.priceMap ?? {},
      prices: p.list ?? [],
      invoices: f.invoices ?? [],
    });
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push(`/${locale}/login`); return; }
    if (user.role !== 'school' && user.role !== 'admin') { router.push(`/${locale}`); return; }
    reload();
  }, [user, isLoading, locale, router, reload]);

  useEffect(() => setOpen(false), [pathname]);

  if (isLoading || !user || !data) {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Sökvägen saknar språkprefix (localePrefix: 'never'), men tål båda
  const path = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '');
  const isActive = (href: string) => (href === '/school' ? path === '/school' : path.startsWith(href));
  const initials = (user.name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || 'S';

  const brand = (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-xl bg-white theme-keep overflow-hidden flex items-center justify-center shrink-0">
        <Image src="/logo.png" alt="Uppsala Halkbana" width={36} height={36} className="w-full h-full object-contain scale-110" />
      </span>
      <span className="font-headline font-extrabold text-[15px] text-white">Uppsala Halkbana</span>
    </div>
  );

  const item = (n: typeof NAV[number], rail = false) => {
    const Icon = n.icon;
    const active = isActive(n.href);
    return (
      <Link
        key={n.href}
        href={`/${locale}${n.href}`}
        className={clsx(
          rail
            ? 'flex flex-col items-center justify-center gap-0.5 w-[68px] py-1.5 rounded-xl text-[11px] leading-tight transition text-center'
            : 'flex items-center gap-3 h-10 px-3 rounded-xl text-[15px] transition w-full',
          active ? 'bg-white/10 text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5',
        )}
      >
        <Icon className={clsx(rail ? 'w-5 h-5 shrink-0' : 'w-[18px] h-[18px] shrink-0', `ic-${n.ic}`)} strokeWidth={1.75} />
        {n.label}
      </Link>
    );
  };

  const body = (
    <>
      <nav className="flex-1 overflow-y-auto -mx-1 px-1">
        <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/35">Trafikskola</p>
        <div className="flex flex-col gap-0.5">{NAV.map(n => item(n))}</div>
      </nav>
      <div className="border-t border-white/5 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2">
          <span className="w-9 h-9 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center shrink-0">{initials}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.name}</p>
            <p className="text-xs text-white/50">Trafikskolekonto</p>
          </div>
        </div>
        <InstallAppButton dark className="mt-3 w-full" />
        <ThemeToggle className="mt-3 w-full" />
        <button
          onClick={logout}
          className="mt-3 w-full h-10 rounded-full border border-white/15 text-sm font-semibold text-white hover:bg-white/5 inline-flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.75} /> Logga ut
        </button>
      </div>
    </>
  );

  return (
    <Ctx.Provider value={{ ...data, reload }}>
      <div className="min-h-screen bg-[#0b0b0d] text-white">
        <PortalThemeRoot />
        {/* Surfplatta: smal ikonmeny */}
        <aside className="admin-dark hidden md:flex xl:hidden fixed inset-y-0 left-0 z-30 w-[84px] flex-col items-center bg-[#161618] border-r border-white/5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <span className="w-11 h-11 rounded-xl bg-white theme-keep overflow-hidden flex items-center justify-center shrink-0 mb-3">
            <Image src="/logo.png" alt="Uppsala Halkbana" width={44} height={44} className="w-full h-full object-contain scale-110" />
          </span>
          <nav className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-1">{NAV.map(n => item(n, true))}</nav>
          <div className="flex flex-col items-center gap-2 pt-3 mt-2 border-t border-white/5 w-full">
            <InstallAppButton dark iconOnly />
            <ThemeToggle iconOnly />
            <button onClick={logout} title={`Logga ut ${user.name ?? ''}`} aria-label="Logga ut" className="w-11 h-11 rounded-full text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center">
              <LogOut className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        </aside>

        {/* Dator: fast sidomeny */}
        <aside className="admin-dark hidden xl:flex fixed inset-y-0 left-0 z-30 w-60 flex-col bg-[#161618] border-r border-white/5 px-3 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] overflow-y-auto">
          <div className="px-2 mb-7">{brand}</div>
          {body}
        </aside>

        {/* Mobil: toppfält och utfällbar meny */}
        <header className="admin-dark md:hidden sticky top-[env(safe-area-inset-top)] z-30 h-14 px-4 flex items-center justify-between bg-[#161618] border-b border-white/5">
          {brand}
          <button onClick={() => setOpen(true)} aria-label="Öppna meny" className="w-10 h-10 -mr-2 flex items-center justify-center rounded-xl text-white hover:bg-white/5">
            <Menu className="w-5 h-5" />
          </button>
        </header>
        {open && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}>
            <aside onClick={e => e.stopPropagation()} className="absolute inset-y-0 left-0 w-72 max-w-[85%] flex flex-col bg-[#161618] px-3 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] overflow-y-auto">
              <div className="flex items-center justify-between px-2 mb-6">
                {brand}
                <button onClick={() => setOpen(false)} aria-label="Stäng meny" className="w-10 h-10 flex items-center justify-center rounded-xl text-white hover:bg-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {body}
            </aside>
          </div>
        )}

        <div className="md:pl-[84px] xl:pl-60">{children}</div>
      </div>
    </Ctx.Provider>
  );
}

/** Sidhuvud + innehåll för en sida i skolportalen. */
export function SchoolPage({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight break-words">{title}</h1>
          {subtitle && <p className="text-sm text-white/50 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="space-y-5">{children}</div>
    </main>
  );
}

/** Siffra med ikon, som i adminens översikt. */
export function StatCard({ icon: Icon, value, label, tone = 'text-white', href }: { icon: LucideIcon; value: React.ReactNode; label: string; tone?: string; href?: string }) {
  const locale = useLocale();
  const inner = (
    <>
      <span className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><Icon className={clsx('w-5 h-5', tone)} strokeWidth={1.75} /></span>
      <div className="min-w-0">
        <p className="font-headline text-2xl sm:text-3xl font-extrabold leading-none truncate">{value}</p>
        <p className="text-xs sm:text-sm text-white/50 mt-1.5">{label}</p>
      </div>
    </>
  );
  const cls = 'rounded-3xl bg-[#1c1c1f] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 transition';
  return href
    ? <Link href={`/${locale}${href}`} className={clsx(cls, 'hover:bg-[#232327]')}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}
