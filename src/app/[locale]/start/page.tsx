import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PORTALS: Record<string, string> = { admin: '/admin', instructor: '/instruktor', school: '/school' };

/** Appens startsida: inloggad personal hamnar direkt i sin portal, kunder på startsidan. */
export default async function StartPage() {
  const user = await getAuthUser();
  redirect((user && PORTALS[user.role]) || '/');
}
