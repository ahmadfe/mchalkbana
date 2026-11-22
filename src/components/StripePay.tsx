'use client';

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

/*
 * Stripes säkra betalformulär i kassan: kort (med Apple Pay / Google Pay när enheten stödjer det) eller Klarna.
 * Kortuppgifterna går direkt till Stripe – vi ser dem aldrig.
 * Kassan anropar pay() när kunden trycker "Betala": formuläret kontrolleras, bokningen skapas på servern
 * (/api/stripe/intent) och betalningen bekräftas. Klarna och ibland 3-D Secure skickar kunden vidare och tillbaka.
 */

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
let stripePromise: Promise<StripeJs | null> | null = null;
const getStripeJs = () => (stripePromise ??= loadStripe(publishableKey));

export interface StripePayInput {
  sessionId: number;
  couponCode: string | null;
  guest: { name: string; personnummer: string; phone: string | null; email: string };
  /** Hit kommer kunden tillbaka efter Klarna / 3-D Secure */
  returnUrl: string;
}
export type StripePayResult =
  | { status: 'paid'; bookingId: number }
  /** Klarna kan behöva en stund – kassan väntar tills bokningen blir betald */
  | { status: 'processing'; bookingId: number }
  | { status: 'redirecting' }
  | { status: 'error'; error: string };
export interface StripePayHandle { pay: (input: StripePayInput) => Promise<StripePayResult> }

interface Props { method: 'card' | 'klarna'; amount: number; locale: string }

const StripePay = forwardRef<StripePayHandle, Props>(function StripePay({ method, amount, locale }, ref) {
  const options = useMemo(() => ({
    mode: 'payment' as const,
    amount: amount * 100,
    currency: 'sek',
    allowedPaymentMethodTypes: [method],
    locale: (locale === 'en' ? 'en' : 'sv') as 'sv' | 'en',
    appearance: {
      theme: 'stripe' as const,
      variables: { colorPrimary: '#0b5f8a', borderRadius: '12px', fontFamily: 'inherit' },
    },
  }), [method, amount, locale]);

  // Ny ruta när betalsätt eller pris ändras
  return (
    <Elements key={`${method}-${amount}`} stripe={getStripeJs()} options={options}>
      <Inner ref={ref} method={method} />
    </Elements>
  );
});

const Inner = forwardRef<StripePayHandle, { method: 'card' | 'klarna' }>(function Inner({ method }, ref) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    async pay(input) {
      if (!stripe || !elements || !ready) return { status: 'error', error: 'Betalformuläret laddar fortfarande – vänta en sekund och försök igen.' };

      // 1. Kontrollera formuläret (kortnummer m.m.) innan något bokas
      const submitted = await elements.submit();
      if (submitted.error) return { status: 'error', error: submitted.error.message ?? 'Kontrollera betaluppgifterna' };

      // 2. Boka och skapa betalningen på servern (priset räknas där)
      const res = await fetch('/api/stripe/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: input.sessionId,
          couponCode: input.couponCode,
          method,
          guestName: input.guest.name,
          personnummer: input.guest.personnummer,
          guestPhone: input.guest.phone,
          guestEmail: input.guest.email,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return { status: 'error', error: d.error ?? 'Betalningen kunde inte startas' };

      const returnUrl = `${input.returnUrl}&stripe_booking=${d.bookingId}`;
      // 3. Bekräfta hos Stripe (Klarna skickar kunden vidare – vi kommer tillbaka till returnUrl)
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: d.clientSecret,
        redirect: 'if_required',
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: {
            billing_details: {
              name: input.guest.name,
              email: input.guest.email,
              phone: input.guest.phone || undefined,
            },
          },
        },
      });

      if (error) {
        // Nekat kort / avbrutet – släpp platsen
        await fetch('/api/stripe/abandon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: d.bookingId, paymentIntentId: d.paymentIntentId }) }).catch(() => {});
        return { status: 'error', error: error.message ?? 'Betalningen gick inte igenom' };
      }

      // 4. Klart utan omdirigering – servern kontrollerar betalningen och bekräftar bokningen
      const c = await fetch('/api/stripe/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: d.bookingId, paymentIntentId: paymentIntent?.id ?? d.paymentIntentId }) });
      const cd = await c.json().catch(() => ({}));
      if (cd.status === 'paid') return { status: 'paid', bookingId: d.bookingId };
      if (cd.status === 'processing') return { status: 'processing', bookingId: d.bookingId };
      return { status: 'error', error: cd.error ?? 'Betalningen gick inte igenom' };
    },
  }), [stripe, elements, ready, method]);

  return (
    <PaymentElement
      onReady={() => setReady(true)}
      options={{
        layout: 'tabs',
        // Namn, e-post och telefon finns redan i kassan
        fields: { billingDetails: { name: 'never', email: 'never', phone: 'never' } },
        wallets: { applePay: 'auto', googlePay: 'auto' },
      }}
    />
  );
});

export default StripePay;

/** Stripe visas: live-nyckel, eller testnyckel utanför den skarpa webbplatsen (samma lås som servern) */
export function stripeAvailable(liveSite: boolean): boolean {
  if (publishableKey.startsWith('pk_live_')) return true;
  return !!publishableKey && !liveSite && process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production';
}
