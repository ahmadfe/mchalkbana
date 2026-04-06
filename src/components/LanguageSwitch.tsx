'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';

export default function LanguageSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    const nextLocale = locale === 'sv' ? 'en' : 'sv';
    // Replace the locale prefix in the path
    const newPath = pathname.replace(`/${locale}`, `/${nextLocale}`);
    router.push(newPath);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-sm font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
      aria-label="Switch language"
    >
      <Globe className="w-4 h-4" />
      <span>{locale === 'sv' ? 'EN' : 'SV'}</span>
    </button>
  );
}
