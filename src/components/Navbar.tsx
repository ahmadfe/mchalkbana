'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Menu, X, GraduationCap } from 'lucide-react';
import LanguageSwitch from './LanguageSwitch';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const base = `/${locale}`;

  const handleLogout = async () => {
    await logout();
    router.push(`/${locale}`);
    router.refresh();
  };

  return (
    <nav className="bg-swedish-blue text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={base} className="flex items-center gap-2 font-bold text-lg">
            <GraduationCap className="w-7 h-7 text-swedish-yellow" />
            <span className="hidden sm:inline">Uppsala Halkbana</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href={base} className="hover:text-swedish-yellow transition-colors text-sm font-medium">
              {t('home')}
            </Link>
            {user?.role !== 'school' && (
              <Link href={`${base}/courses`} className="hover:text-swedish-yellow transition-colors text-sm font-medium">
                {t('courses')}
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link href={`${base}/admin`} className="hover:text-swedish-yellow transition-colors text-sm font-medium">
                {t('admin')}
              </Link>
            )}
            {user?.role === 'school' && (
              <Link href={`${base}/school`} className="hover:text-swedish-yellow transition-colors text-sm font-medium">
                Mitt konto
              </Link>
            )}
            {user && user.role !== 'school' && user.role !== 'admin' && (
              <Link href={`${base}/dashboard`} className="hover:text-swedish-yellow transition-colors text-sm font-medium">
                {t('dashboard')}
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitch />
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-blue-200">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded-lg transition"
                >
                  {t('logout')}
                </button>
              </div>
            ) : (
              <Link
                href={`${base}/login`}
                className="text-xs text-blue-200 hover:text-white transition-colors border border-white/20 px-3 py-1.5 rounded-lg"
              >
                {t('school_login')}
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-swedish-blue border-t border-white/10 px-4 py-4 space-y-3">
          <Link href={base} className="block py-2 hover:text-swedish-yellow" onClick={() => setOpen(false)}>
            {t('home')}
          </Link>
          {user?.role !== 'school' && (
            <Link href={`${base}/courses`} className="block py-2 hover:text-swedish-yellow" onClick={() => setOpen(false)}>
              {t('courses')}
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link href={`${base}/admin`} className="block py-2 hover:text-swedish-yellow" onClick={() => setOpen(false)}>
              {t('admin')}
            </Link>
          )}
          {user?.role === 'school' && (
            <Link href={`${base}/school`} className="block py-2 hover:text-swedish-yellow" onClick={() => setOpen(false)}>
              Mitt konto
            </Link>
          )}
          {user && user.role !== 'school' && user.role !== 'admin' && (
            <Link href={`${base}/dashboard`} className="block py-2 hover:text-swedish-yellow" onClick={() => setOpen(false)}>
              {t('dashboard')}
            </Link>
          )}
          <div className="flex items-center gap-3 pt-2 border-t border-white/10">
            <LanguageSwitch />
            {user ? (
              <button onClick={handleLogout} className="text-sm hover:text-swedish-yellow">
                {t('logout')}
              </button>
            ) : (
              <Link
                href={`${base}/login`}
                className="text-xs text-blue-200 hover:text-white border border-white/20 px-3 py-1.5 rounded-lg"
                onClick={() => setOpen(false)}
              >
                {t('school_login')}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
