'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context/AuthContext';

/** En inloggad trafikskola ska boka via skolportalen – inte via de publika passen. */
export default function SchoolRedirect() {
  const { user } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  useEffect(() => {
    if (user?.role === 'school') router.replace(`/${locale}/school`);
  }, [user, router, locale]);
  return null;
}
