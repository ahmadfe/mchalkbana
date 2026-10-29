export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser, isDisabled } from '@/lib/auth';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  // Ett inaktiverat konto loggas ut vid nästa sidladdning
  if (await isDisabled(user.userId)) {
    const res = NextResponse.json({ user: null }, { status: 401 });
    res.cookies.set('token', '', { maxAge: 0, path: '/' });
    return res;
  }
  return NextResponse.json({ user });
}
