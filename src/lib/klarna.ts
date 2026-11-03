/*
 * Klarna Payments + Order Management (server). Beloppen i API:t är i ören.
 * Flöde: session → kunden godkänner i Klarnas widget (authorization_token) → order (reserverat belopp)
 * → dras (capture) när kursen är genomförd, eller släpps (cancel) vid avbokning i tid.
 * Nyckeln är en API-nyckel från Klarnas nya plattform (klarna_test_api_… / klarna_live_api_…) och skickas som "Basic <nyckel>".
 */

const API_KEY = () => process.env.KLARNA_API_KEY || process.env.KLARNA_PASSWORD || '';
const BASE = () => process.env.KLARNA_ENV === 'production' ? 'https://api.klarna.com' : 'https://api.playground.klarna.com';

/**
 * Klarna i kassan. På den skarpa webbplatsen (Vercel production) krävs skarpa nycklar – med testnycklar
 * skulle kunder få bekräftade bokningar utan riktig betalning.
 */
export const klarnaConfigured = () => !!API_KEY() && (process.env.VERCEL_ENV !== 'production' || process.env.KLARNA_ENV === 'production');

/** Moms 25 % ingår i alla kurspriser */
const TAX_RATE = 2500;

export class KlarnaError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function klarnaFetch<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(BASE() + path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Basic ${API_KEY()}`,
      'Content-Type': 'application/json',
      ...(init.idempotencyKey ? { 'Klarna-Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = data?.error_code ?? `HTTP_${res.status}`;
    console.error('[Klarna]', init.method ?? 'POST', path, res.status, code, data?.error_messages, data?.correlation_id);
    throw new KlarnaError(res.status, code, (data?.error_messages ?? []).join('; ') || code);
  }
  return data as T;
}

export interface KlarnaOrderInput {
  /** Pris i kronor inkl. moms */
  amount: number;
  title: string;
  /** Visas i Klarna-appen, t.ex. kursdatum */
  description: string;
  productUrl?: string;
  imageUrl?: string;
}

/** Orderdata som måste vara identisk i session och order */
function orderData(o: KlarnaOrderInput) {
  const total = Math.round(o.amount * 100);
  const tax = total - Math.round((total * 10000) / (10000 + TAX_RATE));
  return {
    purchase_country: 'SE',
    purchase_currency: 'SEK',
    locale: 'sv-SE',
    order_amount: total,
    order_tax_amount: tax,
    order_lines: [{
      type: 'digital',
      reference: 'kurs',
      name: `${o.title} – ${o.description}`.slice(0, 255),
      quantity: 1,
      unit_price: total,
      tax_rate: TAX_RATE,
      total_amount: total,
      total_tax_amount: tax,
      ...(o.productUrl ? { product_url: o.productUrl } : {}),
      ...(o.imageUrl ? { image_url: o.imageUrl } : {}),
    }],
  };
}

export interface KlarnaSession {
  session_id: string;
  client_token: string;
  payment_method_categories: { identifier: string; name: string; asset_urls?: { descriptive?: string; standard?: string } }[];
}

export function createSession(o: KlarnaOrderInput): Promise<KlarnaSession> {
  return klarnaFetch('/payments/v1/sessions', { body: { acquiring_channel: 'ECOMMERCE', intent: 'buy', ...orderData(o) } });
}

export interface KlarnaOrderResult { order_id: string; fraud_status: 'ACCEPTED' | 'PENDING' | 'REJECTED'; redirect_url?: string }

/** Skapar ordern från kundens godkännande. Beloppet reserveras, inget dras (auto_capture av). */
export function createOrder(authorizationToken: string, o: KlarnaOrderInput, refs: { bookingId: number; sessionId: number }, customer: { firstName: string; lastName: string; email: string; phone?: string | null }): Promise<KlarnaOrderResult> {
  return klarnaFetch(`/payments/v1/authorizations/${encodeURIComponent(authorizationToken)}/order`, {
    body: {
      ...orderData(o),
      auto_capture: false,
      merchant_reference1: String(refs.bookingId),
      merchant_reference2: `kurs-${refs.sessionId}`,
      billing_address: {
        given_name: customer.firstName,
        family_name: customer.lastName,
        email: customer.email,
        ...(customer.phone ? { phone: customer.phone } : {}),
        country: 'SE',
      },
    },
  });
}

export interface KlarnaOrder {
  order_id: string;
  status: 'AUTHORIZED' | 'PART_CAPTURED' | 'CAPTURED' | 'CANCELLED' | 'EXPIRED' | 'CLOSED';
  expires_at?: string;
  remaining_authorized_amount: number;
  captured_amount: number;
  refunded_amount: number;
}

export const getOrder = (orderId: string) => klarnaFetch<KlarnaOrder>(`/ordermanagement/v1/orders/${orderId}`);

/** Drar hela det reserverade beloppet */
export async function captureOrder(orderId: string, amountKr: number, description: string) {
  await klarnaFetch(`/ordermanagement/v1/orders/${orderId}/captures`, {
    body: { captured_amount: Math.round(amountKr * 100), description: description.slice(0, 255) },
    idempotencyKey: `capture-${orderId}`,
  });
}

/** Släpper reservationen (avbokning i tid) – kunden debiteras inget */
export async function cancelOrder(orderId: string) {
  await klarnaFetch(`/ordermanagement/v1/orders/${orderId}/cancel`, { method: 'POST' });
}

export async function refundOrder(orderId: string, amountKr: number, description: string) {
  await klarnaFetch(`/ordermanagement/v1/orders/${orderId}/refunds`, {
    body: { refunded_amount: Math.round(amountKr * 100), description: description.slice(0, 255) },
    idempotencyKey: `refund-${orderId}-${Math.round(amountKr * 100)}`,
  });
}

/** Förlänger reservationen (om Klarna tillåter) när kursen ligger längre fram än reservationen räcker */
export async function extendAuthorization(orderId: string) {
  await klarnaFetch(`/ordermanagement/v1/orders/${orderId}/extend-authorization-time`, { method: 'POST' });
}
