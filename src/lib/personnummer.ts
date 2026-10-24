import crypto from 'crypto';

// AES-256-GCM för lagring, HMAC-SHA256 för uppslag. Nyckeln ligger i ENCRYPTION_KEY (32 byte, base64 eller hex).
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY saknas');
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY måste vara 32 byte');
  return key;
}

/** Returnerar 12 siffror (ÅÅÅÅMMDDXXXX) eller null om det inte går att tolka. */
export function normalizePersonnummer(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 12) return digits;
  if (digits.length !== 10) return null;
  const yy = parseInt(digits.slice(0, 2), 10);
  const currentYY = new Date().getFullYear() % 100;
  let century = yy <= currentYY ? 2000 : 1900;
  if (trimmed.includes('+')) century -= 100;
  return String(century / 100) + digits;
}

export function formatPersonnummer(pnr12: string): string {
  return `${pnr12.slice(0, 8)}-${pnr12.slice(8)}`;
}

export function ageFromPersonnummer(pnr12: string, at = new Date()): number | null {
  const y = +pnr12.slice(0, 4), m = +pnr12.slice(4, 6), d = +pnr12.slice(6, 8) % 60; // samordningsnummer: dag + 60
  if (!y || !m || !d) return null;
  let age = at.getFullYear() - y;
  if (at.getMonth() + 1 < m || (at.getMonth() + 1 === m && at.getDate() < d)) age--;
  return age;
}

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
