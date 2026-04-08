import https from 'node:https';

export interface SwishPaymentStatus {
  id: string;
  status: 'CREATED' | 'PAID' | 'DECLINED' | 'ERROR' | 'TIMEOUT';
  paymentReference?: string;
  payeePaymentReference?: string;
  amount: number;
  errorCode?: string;
  errorMessage?: string;
}

function getSwishAgent() {
  const pfxBase64 = process.env.SWISH_CERT_PFX;
  if (!pfxBase64) throw new Error('SWISH_CERT_PFX not configured');
  return new https.Agent({
    pfx: Buffer.from(pfxBase64, 'base64'),
    passphrase: process.env.SWISH_CERT_PASSPHRASE ?? '',
  });
}

function getSwishHost(): string {
  // SWISH_ENV=production → real Swish, anything else → MSS test simulator
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
        path: `/swish-cpcapi/api/v2${path}`,
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

export async function createPaymentRequest(params: {
  bookingId: number;
  amount: number;
  payerPhone: string;
  message: string;
}): Promise<{ swishRequestId: string }> {
  const merchantNumber = process.env.SWISH_MERCHANT_NUMBER;
  if (!merchantNumber) throw new Error('SWISH_MERCHANT_NUMBER not configured');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const callbackUrl = `${appUrl}/api/swish/callback`;

  const result = await swishRequest<null>('POST', '/paymentrequests', {
    payeeAlias: merchantNumber,
    payerAlias: formatSwishPhone(params.payerPhone),
    amount: params.amount.toString(),
    currency: 'SEK',
    callbackUrl,
    message: params.message.slice(0, 50),
    payeePaymentReference: params.bookingId.toString(),
  });

  if (result.status === 201 && result.location) {
    const id = result.location.split('/').pop()!;
    return { swishRequestId: id };
  }

  throw new Error(`Swish create error ${result.status}: ${JSON.stringify(result.data)}`);
}

export async function getPaymentRequest(swishRequestId: string): Promise<SwishPaymentStatus> {
  const result = await swishRequest<SwishPaymentStatus>('GET', `/paymentrequests/${swishRequestId}`);
  if (result.status === 200 && result.data) return result.data;
  throw new Error(`Swish get error ${result.status}`);
}
