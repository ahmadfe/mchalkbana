'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

export default function CookieBanner() {
  const t = useTranslations('cookie');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-gray-900 text-white rounded-2xl shadow-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="w-8 h-8 text-swedish-yellow shrink-0" />
        <p className="text-sm flex-1 leading-relaxed">
          {t('message')}{' '}
          <Link href="#" className="underline text-swedish-yellow hover:no-underline">
            {t('policy')}
          </Link>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm border border-white/30 rounded-lg hover:bg-white/10 transition"
          >
            {t('decline')}
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm bg-swedish-yellow text-swedish-blue font-bold rounded-lg hover:bg-yellow-300 transition"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
