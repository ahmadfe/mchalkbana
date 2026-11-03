'use client';

import { useEffect, useRef } from 'react';

/*
 * Klarna On-Site Messaging ("Betala senare med Klarna" under priset) via Klarnas Web SDK v2.
 * Laddas från Klarna (får inte paketeras). Visar inget om Client ID saknas eller Klarna inte svarar.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_KLARNA_CLIENT_ID;
const SDK_URL = 'https://js.klarna.com/web-sdk/v2/klarna.mjs';

interface KlarnaSdk { Messaging: { placement: (o: Record<string, unknown>) => { mount: (el: HTMLElement) => void } } }
let sdk: Promise<KlarnaSdk> | null = null;

function loadSdk(): Promise<KlarnaSdk> {
  sdk ??= (async () => {
    const mod = await import(/* webpackIgnore: true */ SDK_URL);
    return mod.KlarnaSDK({ clientId: CLIENT_ID, products: ['MESSAGING'], locale: 'sv-SE' });
  })().catch(e => { sdk = null; throw e; });
  return sdk;
}

/** Klarnas meddelande för ett pris (kronor inkl. moms) */
export default function KlarnaMessage({ amount, className, theme = 'light' }: { amount: number; className?: string; theme?: 'light' | 'dark' }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID || !ref.current || amount <= 0) return;
    const el = ref.current;
    let cancelled = false;
    loadSdk()
      .then(k => {
        if (cancelled) return;
        el.innerHTML = '';
        k.Messaging.placement({ key: 'credit-promotion-badge', amount: Math.round(amount * 100), currency: 'SEK', locale: 'sv-SE', theme }).mount(el);
      })
      .catch(() => { /* Klarna ej tillgängligt – visa inget */ });
    return () => { cancelled = true; };
  }, [amount, theme]);

  if (!CLIENT_ID) return null;
  return <div ref={ref} className={className} />;
}
