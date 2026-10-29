'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { InstallAppButton } from '@/components/pwa';

/** Lärarportalens ram: mörk som admin, med ett fast toppfält. Bara inloggade lärare. */
export default function InstructorShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'instructor')) router.push(`/${locale}/login`);
  }, [user, isLoading, router, locale]);

  const initials = (user?.name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <header className="admin-dark sticky top-[env(safe-area-inset-top)] z-30 bg-[#161618] border-b border-white/5">
        <div className="max-w-5xl mx-auto h-14 px-4 sm:px-6 flex items-center gap-3">
          <Link href={`/${locale}/instruktor`} className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-headline font-extrabold text-sm shrink-0">U</span>
            <span className="font-headline font-extrabold text-[15px] truncate">Lärare</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <InstallAppButton dark iconOnly />
            {user && (
              <span title={user.name} className="hidden sm:flex items-center gap-2 text-sm text-white/70">
                <span className="w-8 h-8 rounded-full bg-white/10 text-xs font-bold flex items-center justify-center">{initials}</span>
                {user.name}
              </span>
            )}
            <button
              onClick={async () => { await logout(); router.push(`/${locale}/login`); }}
              aria-label="Logga ut"
              title="Logga ut"
              className="w-11 h-11 rounded-full text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
            >
              <LogOut className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>
      {isLoading || user?.role !== 'instructor' ? (
        <div className="py-24 flex justify-center"><div className="w-7 h-7 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">{children}</main>
      )}
    </div>
  );
}
