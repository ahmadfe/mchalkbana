'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Menu, X } from 'lucide-react';
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
    <nav className="sticky top-0 z-50 bg-[#fbf9f8]/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-3">
          {/* Logo */}
          <Link href={base} className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Uppsala Halkbana"
              width={48}
              height={48}
              className="rounded-xl object-contain"
            />
            <span className="hidden sm:inline font-headline font-bold text-gray-900 text-base leading-tight">
              Uppsala<br />Halkbana
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7">
            <Link href={base} className="text-gray-600 hover:text-swedish-blue transition-colors text-sm font-medium">
              {t('home')}
            </Link>
            {user?.role !== 'school' && (
              <Link href={`${base}/courses`} className="text-gray-600 hover:text-swedish-blue transition-colors text-sm font-medium">
                {t('courses')}
              </Link>
            )}
            <Link href={`${base}/about`} className="text-gray-600 hover:text-swedish-blue transition-colors text-sm font-medium">
              Om oss
            </Link>
            <Link href={`${base}/contact`} className="text-gray-600 hover:text-swedish-blue transition-colors text-sm font-medium">
              Kontakta oss
            </Link>
            <Link href={`${base}/faq`} className="text-gray-600 hover:text-swedish-blue transition-colors text-sm font-medium">
              FAQ
            </Link>
            {user?.role === 'admin' && (
              <Link href={`${base}/admin`} className="text-gray-600 hover:text-swedish-blue transition-colors text-sm font-medium">
                {t('admin')}
              </Link>
            )}
            {user?.role === 'school' && (
              <Link href={`${base}/school`} className="text-gray-600 hover:text-swedish-blue transition-colors text-sm font-medium">
                Mitt konto
              </Link>
            )}
            {user && user.role !== 'school' && user.role !== 'admin' && (
              <Link href={`${base}/dashboard`} className="text-gray-600 hover:text-swedish-blue transition-colors text-sm font-medium">
                {t('dashboard')}
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="border border-gray-300 text-gray-700 hover:border-gray-400 text-sm px-3 py-1.5 rounded-lg transition"
                >
                  {t('logout')}
                </button>
              </div>
            ) : (
              <Link
                href={`${base}/login`}
                className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 transition px-3 py-1.5 rounded-lg"
              >
                {t('school_login')}
              </Link>
            )}
            {user?.role !== 'school' && (
              <Link href={`${base}/courses`} className="btn-primary text-sm px-4 py-2">
                Boka Nu
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-700"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-1 shadow-lg">
          <Link href={base} className="block py-2.5 text-gray-700 hover:text-swedish-blue font-medium" onClick={() => setOpen(false)}>
            {t('home')}
          </Link>
          {user?.role !== 'school' && (
            <Link href={`${base}/courses`} className="block py-2.5 text-gray-700 hover:text-swedish-blue font-medium" onClick={() => setOpen(false)}>
              {t('courses')}
            </Link>
          )}
          <Link href={`${base}/about`} className="block py-2.5 text-gray-700 hover:text-swedish-blue font-medium" onClick={() => setOpen(false)}>
            Om oss
          </Link>
          <Link href={`${base}/contact`} className="block py-2.5 text-gray-700 hover:text-swedish-blue font-medium" onClick={() => setOpen(false)}>
            Kontakta oss
          </Link>
          <Link href={`${base}/faq`} className="block py-2.5 text-gray-700 hover:text-swedish-blue font-medium" onClick={() => setOpen(false)}>
            FAQ
          </Link>
          {user?.role === 'admin' && (
            <Link href={`${base}/admin`} className="block py-2.5 text-gray-700 hover:text-swedish-blue font-medium" onClick={() => setOpen(false)}>
              {t('admin')}
            </Link>
          )}
          {user?.role === 'school' && (
            <Link href={`${base}/school`} className="block py-2.5 text-gray-700 hover:text-swedish-blue font-medium" onClick={() => setOpen(false)}>
              Mitt konto
            </Link>
          )}
          {user && user.role !== 'school' && user.role !== 'admin' && (
            <Link href={`${base}/dashboard`} className="block py-2.5 text-gray-700 hover:text-swedish-blue font-medium" onClick={() => setOpen(false)}>
              {t('dashboard')}
            </Link>
          )}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100 mt-2">
            {user ? (
              <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
                {t('logout')}
              </button>
            ) : (
              <Link
                href={`${base}/login`}
                className="text-xs text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg"
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
