import https from 'node:https';
import crypto from 'node:crypto';

export interface SwishPaymentStatus {
  id: string;
  status: 'CREATED' | 'PAID' | 'DECLINED' | 'ERROR' | 'TIMEOUT';
  paymentReference?: string;
  payeePaymentReference?: string;
  amount: number;
  errorCode?: string;
  errorMessage?: string;
}

// Vercel stores multiline env vars with literal \n — fix to real newlines
function fixPemNewlines(pem: string): string {
  return pem.replace(/\\n/g, '\n');
}

function getSwishAgent() {
  const certPem = process.env.SWISH_CERT_PEM;
  const keyPem = process.env.SWISH_KEY_PEM;

  if (certPem && keyPem) {
    console.log('[Swish] Using PEM cert/key auth, merchant:', process.env.SWISH_MERCHANT_NUMBER);
    return new https.Agent({
      cert: fixPemNewlines(certPem),
      key: fixPemNewlines(keyPem),
    });
  }

  const pfxBase64 = process.env.SWISH_CERT_PFX;
  if (!pfxBase64) throw new Error('SWISH_CERT_PFX or SWISH_CERT_PEM+SWISH_KEY_PEM not configured');
  console.log('[Swish] Using PFX cert auth, merchant:', process.env.SWISH_MERCHANT_NUMBER);
  return new https.Agent({
    pfx: Buffer.from(pfxBase64, 'base64'),
    passphrase: process.env.SWISH_CERT_PASSPHRASE ?? '',
  });
}

function getSwishHost(): string {
  return process.env.SWISH_ENV === 'production'
    ? 'cpc.getswish.net'
    : 'mss.cpc.getswish.net';
}

function swishRequest<T>(
  method: string,
  path: string,
  body?: object,
): Promise<{ status: number; data: T | null; location?: string }> {
  return new Promise((resolve, reject) => {
    const agent = getSwishAgent();
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const req = https.request(
      {
        hostname: getSwishHost(),
        path,
        method,
        agent,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode!,
              data: raw ? (JSON.parse(raw) as T) : null,
              location: res.headers.location as string | undefined,
            });
          } catch {
            resolve({ status: res.statusCode!, data: null, location: res.headers.location as string | undefined });
          }
        });
      },
    );

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/** Convert Swedish phone format (07X-XXX XX XX) to Swish international format (467XXXXXXXX) */
export function formatSwishPhone(phone: string): string {
  const digits = phone.replace(/[\s\-\+]/g, '');
  if (digits.startsWith('0')) return '46' + digits.slice(1);
  if (digits.startsWith('46')) return digits;
  return digits;
}

/** Generate a Swish instruction UUID — 32 char uppercase hex, no dashes */
function generateInstructionUUID(): string {
  return crypto.randomUUID().replace(/-/g, '').toUpperCase();
}

/**
 * Referensen som syns på bankutdraget: elevens namn + bokningsnummer, t.ex. "Tilda-Julin-436".
 * Swish tillåter bara a-ö, A-Ö, 0-9 och "-" (max 35 tecken). Bokningsnumret står alltid sist –
 * callbacken hittar bokningen med det.
 */
export function swishReference(name: string | null | undefined, bookingId: number): string {
  const id = String(bookingId);
  const clean = (name ?? '')
    .normalize('NFC')
    // é → e osv., men behåll å ä ö
    .replace(/[^a-zA-ZåäöÅÄÖ0-9\s-]/g, ch => ch.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    .replace(/[^a-zA-ZåäöÅÄÖ0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const room = 35 - id.length - 1;
  const short = clean.slice(0, room).replace(/-+$/, '');
  return short ? `${short}-${id}` : id;
}

/** Bokningsnumret ur referensen – sista talet ("Tilda-Julin-436" → 436, gamla "436" → 436). */
export function bookingIdFromReference(ref: string): number {
  const m = /(\d+)$/.exec(ref.trim());
  return m ? parseInt(m[1], 10) : NaN;
}

export async function createPaymentRequest(params: {
  bookingId: number;
  /** Elevens namn – visas på bankutdraget */
  name?: string | null;
  amount: number;
  payerPhone: string;
  message: string;
}): Promise<{ swishRequestId: string }> {
  const merchantNumber = process.env.SWISH_MERCHANT_NUMBER;
  if (!merchantNumber) throw new Error('SWISH_MERCHANT_NUMBER not configured');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const callbackUrl = `${appUrl}/api/swish/callback`;

  // v2 API: PUT with client-generated UUID
  const instructionUUID = generateInstructionUUID();
  const path = `/swish-cpcapi/api/v2/paymentrequests/${instructionUUID}`;

  console.log('[Swish] Creating payment request, UUID:', instructionUUID, 'host:', getSwishHost());

  const result = await swishRequest<null>('PUT', path, {
    payeeAlias: merchantNumber,
    payerAlias: formatSwishPhone(params.payerPhone),
    amount: params.amount,
    currency: 'SEK',
    callbackUrl,
    message: params.message
      .replace(/–/g, '-')   // en-dash → ASCII hyphen
      .replace(/[^\w\såäöÅÄÖ.,\-:;!?+()*/]/g, '')  // strip other disallowed chars
      .slice(0, 50),
    payeePaymentReference: swishReference(params.name, params.bookingId),
  });

  if (result.status === 201) {
    const id = result.location ? result.location.split('/').pop()! : instructionUUID;
    console.log('[Swish] Payment request created, ID:', id);
    return { swishRequestId: id };
  }

  console.error('[Swish] Full error response:', result.status, JSON.stringify(result.data));
  console.error('[Swish] Request was:', {
    host: getSwishHost(),
    merchant: merchantNumber,
    payer: formatSwishPhone(params.payerPhone),
    amount: params.amount,
    env: process.env.SWISH_ENV,
    path,
  });
  throw new Error(`Swish create error ${result.status}: ${JSON.stringify(result.data)}`);
}

export async function getPaymentRequest(swishRequestId: string): Promise<SwishPaymentStatus> {
  const result = await swishRequest<SwishPaymentStatus>(
    'GET',
    `/swish-cpcapi/api/v2/paymentrequests/${swishRequestId}`,
  );
  if (result.status === 200 && result.data) return result.data;
  throw new Error(`Swish get error ${result.status}`);
}

/** Issue a Swish refund against an original payment reference */
export async function createRefund(params: {
  originalPaymentReference: string;
  amount: number;
  message: string;
}): Promise<{ swishRefundId: string }> {
  const merchantNumber = process.env.SWISH_MERCHANT_NUMBER;
  if (!merchantNumber) throw new Error('SWISH_MERCHANT_NUMBER not configured');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const callbackUrl = `${appUrl}/api/swish/callback`;

  const instructionUUID = generateInstructionUUID();
  const path = `/swish-cpcapi/api/v2/refunds/${instructionUUID}`;

  console.log('[Swish] Creating refund, UUID:', instructionUUID, 'originalRef:', params.originalPaymentReference);

  const result = await swishRequest<null>('PUT', path, {
    originalPaymentReference: params.originalPaymentReference,
    callbackUrl,
    payerAlias: merchantNumber,
    amount: params.amount,
    currency: 'SEK',
    message: params.message
      .replace(/–/g, '-')
      .replace(/[^\w\såäöÅÄÖ.,\-:;!?+()*/]/g, '')
      .slice(0, 50),
  });

  if (result.status === 201) {
    const id = result.location ? result.location.split('/').pop()! : instructionUUID;
    console.log('[Swish] Refund created, ID:', id);
    return { swishRefundId: id };
  }

  console.error('[Swish] Refund error response:', result.status, JSON.stringify(result.data));
  throw new Error(`Swish refund error ${result.status}: ${JSON.stringify(result.data)}`);
}

// ── Begripliga felmeddelanden från Swish ───────────────────────────────────

const SWISH_ERROR_MESSAGES: Record<string, string> = {
  ACMT03: 'Mobilnumret är inte anslutet till Swish. Kontrollera att du angett rätt nummer och att Swish är aktiverat.',
  ACMT07: 'Swish-kontot är inte aktivt. Kontakta din bank.',
  BE18:   'Ogiltigt mobilnummer. Kontrollera att du angett rätt format (t.ex. 070-123 45 67).',
  RF07:   'Betalningen avvisades av Swish. Försök igen.',
  FF10:   'Betalningen avvisades av din bank. Kontakta din bank för mer information.',
  TM01:   'Tidsgräns nådd – du godkände inte betalningen i tid. Försök igen.',
  BANKIDCL: 'BankID-verifiering avbröts. Försök igen.',
};

export function swishFriendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  try {
    const match = msg.match(/\[(\[.+\])\]$/) ?? msg.match(/(\[.+\])$/);
    if (match) {
      const codes = JSON.parse(match[1]) as Array<{ errorCode?: string }>;
      const code = codes[0]?.errorCode;
      if (code && SWISH_ERROR_MESSAGES[code]) return SWISH_ERROR_MESSAGES[code];
    }
  } catch {
    // fall through to generic message
  }
  return 'Swish-betalning misslyckades. Försök igen eller kontakta oss på 07 07 66 66 61.';
}
