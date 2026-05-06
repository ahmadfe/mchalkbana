import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'uppsalahalkbana-secret-key-change-in-production'
);

export interface BookingTokenPayload {
  bookingId: number;
  type: 'booking-change';
}

export async function signBookingToken(bookingId: number): Promise<string> {
  return new SignJWT({ bookingId, type: 'booking-change' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

export async function verifyBookingToken(token: string): Promise<BookingTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== 'booking-change' || typeof payload.bookingId !== 'number') return null;
    return { bookingId: payload.bookingId as number, type: 'booking-change' };
  } catch {
    return null;
  }
}
