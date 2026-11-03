'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import clsx from 'clsx';

/*
 * Klarnas betalwidget i kassan (Klarna Payments JS). Sessionen skapas på servern med priset
 * (inkl. rabattkod); widgeten visar Klarnas egna alternativ, t.ex. "Betala senare" och "Betala direkt".
 * authorize() ger en authorization_token som servern gör om till en order.
 */

interface KlarnaPaymentsApi {
  init: (o: { client_token: string }) => void;
  load: (o: { container: string; payment_method_category: string }, data: object, cb: (res: { show_form: boolean; error?: unknown }) => void) => void;
  authorize: (o: { payment_method_category: string }, data: object, cb: (res: { approved: boolean; show_form: boolean; authorization_token?: string; error?: unknown }) => void) => void;
}
declare global { interface Window { Klarna?: { Payments: KlarnaPaymentsApi } } }

const SCRIPT = 'https://x.klarnacdn.net/kp/lib/v1/api.js';
let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.Klarna?.Payments) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error('Klarna kunde inte laddas')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface KlarnaBilling { name: string; email: string; phone?: string }
export interface KlarnaCheckoutHandle {
  /** Öppnar Klarnas godkännande. Ger token, eller null om kunden avbröt / nekades. */
  authorize: (billing: KlarnaBilling) => Promise<{ token: string } | { error: string }>;
}

const CONTAINER = 'klarna-payments-container';

const KlarnaCheckout = forwardRef<KlarnaCheckoutHandle, { sessionId: number; couponCode: string | null }>(function KlarnaCheckout({ sessionId, couponCode }, ref) {
  const [categories, setCategories] = useState<{ id: string; name: string; logo: string | null }[]>([]);
  const [category, setCategory] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const initialized = useRef(false);

  // Ny session när kursen eller rabattkoden ändras (priset måste stämma med ordern)
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    initialized.current = false;
    (async () => {
      try {
        const [res] = await Promise.all([
          fetch('/api/klarna/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, couponCode }) }),
          loadScript(),
        ]);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) { setMessage(data.error ?? 'Klarna är inte tillgängligt just nu'); setState('error'); return; }
        window.Klarna!.Payments.init({ client_token: data.clientToken });
        initialized.current = true;
        setCategories(data.categories);
        setCategory(c => data.categories.some((x: { id: string }) => x.id === c) ? c : data.categories[0]?.id ?? '');
        setState(data.categories.length ? 'ready' : 'error');
        if (!data.categories.length) setMessage('Klarna erbjuder inga betalsätt för det här köpet');
      } catch {
        if (!cancelled) { setMessage('Klarna kunde inte laddas – kontrollera anslutningen eller välj Swish'); setState('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, couponCode]);

  // Visa Klarnas formulär för valt betalsätt
  useEffect(() => {
    if (state !== 'ready' || !category || !initialized.current) return;
    window.Klarna!.Payments.load({ container: `#${CONTAINER}`, payment_method_category: category }, {}, res => {
      if (!res.show_form) setMessage('Det här betalsättet är inte tillgängligt – välj ett annat');
      else setMessage('');
    });
  }, [state, category]);

  useImperativeHandle(ref, () => ({
    authorize: (billing) => new Promise(resolve => {
      if (state !== 'ready' || !category) { resolve({ error: 'Klarna är inte redo än' }); return; }
      const parts = billing.name.trim().split(/\s+/);
      const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
      const family = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      window.Klarna!.Payments.authorize(
        { payment_method_category: category },
        { billing_address: { given_name: given, family_name: family, email: billing.email, ...(billing.phone ? { phone: billing.phone } : {}), country: 'SE' } },
        res => {
          if (res.approved && res.authorization_token) resolve({ token: res.authorization_token });
          else if (!res.show_form) resolve({ error: 'Klarna kunde inte godkänna köpet – välj ett annat betalsätt eller Swish' });
          else resolve({ error: 'Betalningen avbröts' });
        },
      );
    }),
  }), [state, category]);

  if (state === 'loading') {
    return <div className="flex items-center gap-2 text-sm text-gray-500 py-3"><div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Laddar Klarna…</div>;
  }
  if (state === 'error') return <p className="text-sm text-red-600 py-2">{message}</p>;

  return (
    <div className="space-y-3">
      {categories.length > 1 && (
        <div className="grid gap-2" role="radiogroup" aria-label="Klarnas betalsätt">
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={category === c.id}
              onClick={() => setCategory(c.id)}
              className={clsx('flex items-center gap-3 h-12 px-4 rounded-xl border text-left text-sm font-semibold transition', category === c.id ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-400')}
            >
              <span className={clsx('w-4 h-4 rounded-full border-2 shrink-0', category === c.id ? 'border-gray-900 bg-gray-900 shadow-[inset_0_0_0_3px_white]' : 'border-gray-300')} />
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div id={CONTAINER} />
      {message && <p className="text-sm text-amber-700">{message}</p>}
    </div>
  );
});

export default KlarnaCheckout;
