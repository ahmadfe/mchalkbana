'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'sv';

  useEffect(() => {
    router.replace(`/${locale}`);
  }, [router, locale]);

  return null;
}
