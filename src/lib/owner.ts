/**
 * Ägaren ser intäkter och Swish-betalningar. Andra administratörer (t.ex. det
 * delade info@-kontot) ser allt annat i admin men inte pengarna.
 */
export const OWNER_EMAILS = ['ahmadfe@icloud.com'];

export function isOwner(user: { role?: string; email?: string } | null | undefined): boolean {
  return !!user && user.role === 'admin' && !!user.email && OWNER_EMAILS.includes(user.email.toLowerCase());
}
