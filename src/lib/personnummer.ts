import crypto from 'crypto';

// AES-256-GCM för lagring, HMAC-SHA256 för uppslag. Nyckeln ligger i ENCRYPTION_KEY (32 byte, base64 eller hex).
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY saknas');
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY måste vara 32 byte');
  return key;
}

export { normalizePersonnummer, formatPersonnummer, ageFromPersonnummer } from './pnr';

export function hashPersonnummer(pnr12: string): string {
  return crypto.createHmac('sha256', getKey()).update(pnr12).digest('hex');
}

export function encryptPersonnummer(pnr12: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(pnr12, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decryptPersonnummer(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [version, iv, tag, data] = payload.split(':');
  if (version !== 'v1') return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
