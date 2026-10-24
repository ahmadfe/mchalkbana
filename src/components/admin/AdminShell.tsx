'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { BookOpen, ChevronLeft, Home, LogOut, MapPin, Menu, ShieldCheck, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { href: '/admin', label: 'Översikt', icon: Home },
  { href: '/admin/kurser', label: 'Kurser', icon: BookOpen },
  { href: '/admin/elever', label: 'Elever', icon: Users },
  { href: '/admin/tillsyn', label: 'Tillsyn', icon: ShieldCheck },
  { href: '/admin/filialer', label: 'Filialer', icon: MapPin },
];

interface Props {
  title: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AdminShell({ title, back, actions, children }: Props) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.push(`/${locale}/login`);
    else if (user.role !== 'admin') router.push(`/${locale}/dashboard`);
  }, [user, isLoading, router, locale]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (isLoading || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Sökvägen saknar språkprefix (localePrefix: 'never'), men tål båda
  const path = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '');
  const isActive = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={`/${locale}${href}`}
          className={clsx(
            'flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] transition',
            isActive(href) ? 'bg-white/10 text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5',
          )}
        >
          <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          {label}
        </Link>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-headline font-extrabold text-sm">U</span>
      <span className="font-headline font-extrabold text-[15px]">Uppsala Halkbana</span>
    </div>
  );

  const footer = (
    <div className="border-t border-white/5 pt-4 mt-4">
      <p className="text-sm font-semibold truncate px-3">{user.name}</p>
      <button onClick={logout} className="flex items-center gap-3 h-10 px-3 mt-1 w-full rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5">
        <LogOut className="w-4 h-4" strokeWidth={1.75} /> Logga ut
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      {/* Sidomeny – fast på dator */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-[#161618] border-r border-white/5 px-3 py-5">
        <div className="px-2 mb-7">{brand}</div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {footer}
      </aside>

      {/* Mobil: toppfält med meny */}
      <header className="lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between bg-[#161618]/95 backdrop-blur border-b border-white/5">
        {brand}
        <button onClick={() => setMenuOpen(true)} aria-label="Öppna meny" className="w-10 h-10 -mr-2 flex items-center justify-center rounded-xl hover:bg-white/5">
          <Menu className="w-5 h-5" />
        </button>
      </header>
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMenuOpen(false)}>
          <aside onClick={e => e.stopPropagation()} className="absolute inset-y-0 left-0 w-72 max-w-[85%] flex flex-col bg-[#161618] px-3 py-4">
            <div className="flex items-center justify-between px-2 mb-6">
              {brand}
              <button onClick={() => setMenuOpen(false)} aria-label="Stäng meny" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {footer}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          {back && (
            <Link href={`/${locale}${back.href}`} className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white mb-2">
              <ChevronLeft className="w-4 h-4" /> {back.label}
            </Link>
          )}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div className="min-w-0">
              <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight break-words">{title}</h1>
              <p className="text-sm text-white/50 mt-1">Uppsala Halkbana</p>
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
