import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { isOwner } from './owner';
import { prisma } from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'uppsalahalkbana-secret-key-change-in-production'
);

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  name: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getAuthUserFromRequest(request: Request): Promise<JWTPayload | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}

/** Är kontot inaktiverat? (Inaktiverade konton kan inte logga in och kastas ut.) */
export async function isDisabled(userId: number): Promise<boolean> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { disabled: true } });
  return !row || row.disabled;
}

/** Inloggad trafikskola vars konto är aktivt. */
export async function requireSchool(request: Request): Promise<JWTPayload | null> {
  const user = await getAuthUserFromRequest(request);
  if (!user || user.role !== 'school') return null;
  return (await isDisabled(user.userId)) ? null : user;
}

/** Inloggad lärare vars konto är aktivt. */
export async function requireInstructor(request: Request): Promise<JWTPayload | null> {
  const user = await getAuthUserFromRequest(request);
  if (!user || user.role !== 'instructor') return null;
  return (await isDisabled(user.userId)) ? null : user;
}

/** Bara ägaren – intäkter och Swish-betalningar. */
export async function requireOwner(request: Request): Promise<JWTPayload | null> {
  const user = await getAuthUserFromRequest(request);
  return isOwner(user) ? user : null;
}

export async function requireAdmin(request: Request): Promise<JWTPayload | null> {
  const user = await getAuthUserFromRequest(request);
  return user?.role === 'admin' ? user : null;
}
