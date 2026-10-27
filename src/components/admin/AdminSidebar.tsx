'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  BookOpen, Calendar, Home, Layers, LogOut, MapPin, Menu, MessageCircle, MonitorPlay,
  School, ShieldCheck, Tag, UserCircle2, UserCog, Users, X, type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { InstallAppButton } from '@/components/pwa';

/** Flikar som fortfarande ligger i den äldre admin-sidan (/admin?tab=…). */
export type OldTab = 'overview' | 'courses' | 'sessions' | 'students' | 'schools' | 'cards' | 'hero' | 'whatsapp' | 'instructors';

type Item = { label: string; /** Kort namn i surfplattans ikonmeny */ short?: string; icon: LucideIcon } & ({ href: string } | { tab: OldTab });

const SECTIONS: { title?: string; items: Item[] }[] = [
  {
    items: [
      { tab: 'overview', label: 'Översikt', icon: Home },
      { href: '/admin/kurser', label: 'Kurser', icon: BookOpen },
      { href: '/admin/elever', label: 'Elever', icon: Users },
      { href: '/admin/tillsyn', label: 'Tillsyn', icon: ShieldCheck },
      { href: '/admin/filialer', label: 'Filialer', icon: MapPin },
    ],
  },
  {
    title: 'Hantera',
    items: [
      { tab: 'sessions', label: 'Pass och bokningar', short: 'Pass', icon: Calendar },
      { tab: 'courses', label: 'Kursslag', icon: Layers },
      { tab: 'schools', label: 'Trafikskolor', short: 'Skolor', icon: School },
      { tab: 'instructors', label: 'Instruktörer', short: 'Lärare', icon: UserCog },
      { tab: 'students', label: 'Elevprofiler (äldre)', short: 'Profiler', icon: UserCircle2 },
    ],
  },
  {
    title: 'Webbplats',
    items: [
      { tab: 'cards', label: 'Informationskort', short: 'Kort', icon: Tag },
      { tab: 'hero', label: 'Hero-media', short: 'Hero', icon: MonitorPlay },
      { tab: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    ],
  },
];

export const OLD_TAB_LABEL: Record<OldTab, string> = Object.fromEntries(
  SECTIONS.flatMap(s => s.items).filter((i): i is Item & { tab: OldTab } => 'tab' in i).map(i => [i.tab, i.label]),
) as Record<OldTab, string>;

interface Props {
  /** Aktiv flik i den äldre admin-sidan, om vi står där. */
  activeTab?: OldTab;
  /** Byter flik utan att ladda om sidan (bara i den äldre admin-sidan). */
  onOldTab?: (tab: OldTab) => void;
}

export default function AdminSidebar({ activeTab, onOldTab }: Props) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname, activeTab]);

  // Sökvägen saknar språkprefix (localePrefix: 'never'), men tål båda
  const path = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '');

  const renderItem = (item: Item, rail = false) => {
    const Icon = item.icon;
    const cls = (active: boolean) => clsx(
      rail
        ? 'flex flex-col items-center justify-center gap-0.5 w-[68px] py-1.5 rounded-xl text-[11px] leading-tight transition text-center'
        : 'flex items-center gap-3 h-10 px-3 rounded-xl text-[15px] transition w-full text-left',
      active ? 'bg-white/10 text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5',
    );
    const content = rail
      ? <><Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />{item.short ?? item.label}</>
      : <><Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />{item.label}</>;

    if ('href' in item) {
      return <Link key={item.href} href={`/${locale}${item.href}`} className={cls(path.startsWith(item.href))}>{content}</Link>;
    }
    const active = activeTab === item.tab;
    return onOldTab
      ? <button key={item.tab} onClick={() => onOldTab(item.tab)} className={cls(active)}>{content}</button>
      : <Link key={item.tab} href={`/${locale}/admin?tab=${item.tab}`} className={cls(false)}>{content}</Link>;
  };

  const initials = (user?.name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || 'A';

  const brand = (
    <div className="flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-headline font-extrabold text-sm">U</span>
      <span className="font-headline font-extrabold text-[15px] text-white">Uppsala Halkbana</span>
    </div>
  );

  const body = (
    <>
      <nav className="flex-1 overflow-y-auto -mx-1 px-1">
        {SECTIONS.map((s, i) => (
          <div key={i} className={i > 0 ? 'mt-6' : ''}>
            {s.title && <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/35">{s.title}</p>}
            <div className="flex flex-col gap-0.5">{s.items.map(item => renderItem(item))}</div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/5 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2">
          <span className="w-9 h-9 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center shrink-0">{initials}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/50">Administratör</p>
          </div>
        </div>
        <InstallAppButton dark className="mt-3 w-full" />
        <button
          onClick={logout}
          className="mt-3 w-full h-10 rounded-full border border-white/15 text-sm font-semibold text-white hover:bg-white/5 inline-flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.75} /> Logga ut
        </button>
      </div>
    </>
  );

  // Surfplatta: smal ikonmeny som alltid syns
  const rail = (
    <aside className="admin-dark hidden md:flex xl:hidden fixed inset-y-0 left-0 z-30 w-[84px] flex-col items-center bg-[#161618] border-r border-white/5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <nav className="flex-1 w-full overflow-y-auto flex flex-col items-center">
        {SECTIONS.map((s, i) => (
          <div key={i} className={clsx('flex flex-col items-center gap-0.5', i > 0 && 'mt-1.5 pt-1.5 border-t border-white/5')}>
            {s.items.map(item => renderItem(item, true))}
          </div>
        ))}
      </nav>
      <div className="flex flex-col items-center gap-2 pt-3 mt-2 border-t border-white/5 w-full">
        <InstallAppButton dark iconOnly />
        <button onClick={logout} title={`Logga ut ${user?.name ?? ''}`} aria-label="Logga ut" className="w-11 h-11 rounded-full text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center">
          <LogOut className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {rail}
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
    </>
  );
}
