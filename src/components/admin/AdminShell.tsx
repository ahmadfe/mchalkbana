'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { href: '/admin/kurser', label: 'Kurser' },
  { href: '/admin/elever', label: 'Elever' },
  { href: '/admin/filialer', label: 'Filialer' },
  { href: '/admin', label: 'Övrig admin' },
];

interface Props {
  title: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AdminShell({ title, back, actions, children }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.push(`/${locale}/login`);
    else if (user.role !== 'admin') router.push(`/${locale}/dashboard`);
  }, [user, isLoading, router, locale]);

  if (isLoading || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <nav className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-1 overflow-x-auto">
          <span className="font-headline font-extrabold text-sm mr-4 whitespace-nowrap">Uppsala Halkbana</span>
          {NAV.map(item => {
            const href = `/${locale}${item.href}`;
            const active = item.href === '/admin' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={item.href}
                href={href}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition',
                  active ? 'bg-white/10 text-white font-semibold' : 'text-white/50 hover:text-white',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
  );
}
