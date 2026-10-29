import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { isOwner, OWNER_EMAILS } from './owner';
import { generatePassword, sendInstructorCredentialsEmail } from './instructors';
import { sendSchoolAccountEmail, sendStaffAccountEmail } from './email';
import type { JWTPayload } from './auth';

/*
 * Konton för admin, lärare och trafikskolor (sidan Personal).
 * - Bara ägaren (superanvändaren) hanterar andra admins; en admin får ändra sitt eget konto.
 * - Ägarens konto kan aldrig tas bort eller inaktiveras.
 * - En trafikskola med historik (bokningar, fakturor, reservationer) inaktiveras i stället för att tas bort.
 * - Lösenord skapas automatiskt, mejlas och visas för admin en gång.
 */

export type AccountRole = 'admin' | 'instructor' | 'school';
export const ACCOUNT_ROLES: AccountRole[] = ['admin', 'instructor', 'school'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isOwnerEmail = (email: string) => OWNER_EMAILS.includes(email.toLowerCase());

/** Får den inloggade ändra det här kontot? */
function mayManage(me: JWTPayload, target: { id: number; role: string; email: string }): string | null {
  if (target.role === 'admin' && !isOwner(me) && target.id !== me.userId) return 'Bara superanvändaren kan ändra andra administratörer';
  if (isOwnerEmail(target.email) && !isOwner(me)) return 'Superanvändarens konto kan bara ändras av superanvändaren';
  return null;
}

export async function listAccounts(me: JWTPayload) {
  const owner = isOwner(me);
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { role: { in: ACCOUNT_ROLES } },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, email: true, phone: true, role: true, hidden: true, disabled: true, createdAt: true,
      _count: { select: { schoolBookings: true, invoices: true, schoolAllocations: true } },
      assignedSessions: { where: { startTime: { gte: now }, status: { not: 'canceled' } }, select: { id: true } },
    },
  });
  return users
    // Dolda admins (superanvändaren) syns bara för superanvändaren själv
    .filter(u => u.role !== 'admin' || owner || !u.hidden || u.id === me.userId)
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role as AccountRole,
      disabled: u.disabled,
      createdAt: u.createdAt.toISOString(),
      superUser: isOwnerEmail(u.email),
      isMe: u.id === me.userId,
      canManage: !mayManage(me, u),
      upcomingCourses: u.role === 'instructor' ? u.assignedSessions.length : undefined,
      hasHistory: u.role === 'school' ? u._count.schoolBookings + u._count.invoices + u._count.schoolAllocations > 0 : undefined,
    }));
}

async function sendCredentials(role: AccountRole, name: string, email: string, password: string, reset: boolean) {
  if (role === 'instructor') await sendInstructorCredentialsEmail({ email, name, password, reset });
  else if (role === 'school') await sendSchoolAccountEmail({ schoolName: name, email, password });
  else await sendStaffAccountEmail({ name, email, password });
}

export async function createAccount(me: JWTPayload, body: Record<string, unknown>): Promise<{ error: string; status: number } | { id: number; password: string }> {
  const role = body.role as AccountRole;
  if (!ACCOUNT_ROLES.includes(role)) return { error: 'Välj typ av konto', status: 400 };
  if (role === 'admin' && !isOwner(me)) return { error: 'Bara superanvändaren kan skapa administratörer', status: 403 };
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').toLowerCase().trim();
  const phone = String(body.phone ?? '').trim() || null;
  if (!name) return { error: 'Namn krävs', status: 400 };
  if (!EMAIL_RE.test(email)) return { error: 'Ogiltig e-postadress', status: 400 };
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return { error: 'E-postadressen används redan', status: 409 };

  const password = generatePassword();
  const user = await prisma.user.create({
    data: { name, email, phone, role, password: await bcrypt.hash(password, 12) },
    select: { id: true },
  });
  await sendCredentials(role, name, email, password, false);
  return { id: user.id, password };
}

export async function updateAccount(
  me: JWTPayload,
  id: number,
  body: Record<string, unknown>,
): Promise<{ error: string; status: number } | { ok: true; password?: string }> {
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, disabled: true } });
  if (!target || !ACCOUNT_ROLES.includes(target.role as AccountRole)) return { error: 'Kontot hittades inte', status: 404 };
  const denied = mayManage(me, target);
  if (denied) return { error: denied, status: 403 };

  if (body.resetPassword) {
    const password = generatePassword();
    await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(password, 12) } });
    await sendCredentials(target.role as AccountRole, target.name, target.email, password, true);
    return { ok: true, password };
  }

  if (body.disabled !== undefined) {
    if (isOwnerEmail(target.email)) return { error: 'Superanvändarens konto kan inte inaktiveras', status: 400 };
    if (target.id === me.userId) return { error: 'Du kan inte inaktivera ditt eget konto', status: 400 };
    await prisma.user.update({ where: { id }, data: { disabled: !!body.disabled } });
    return { ok: true };
  }

  const data: { name?: string; email?: string; phone?: string | null } = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) return { error: 'Namn krävs', status: 400 };
    data.name = String(body.name).trim();
  }
  if (body.email !== undefined) {
    const email = String(body.email).toLowerCase().trim();
    if (!EMAIL_RE.test(email)) return { error: 'Ogiltig e-postadress', status: 400 };
    // Superanvändaren känns igen på e-posten – den får inte bytas bort
    if (isOwnerEmail(target.email) && email !== target.email) return { error: 'Superanvändarens e-post kan inte ändras här', status: 400 };
    const taken = await prisma.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } });
    if (taken) return { error: 'E-postadressen används redan av ett annat konto', status: 409 };
    data.email = email;
  }
  if (body.phone !== undefined) data.phone = String(body.phone).trim() || null;
  await prisma.user.update({ where: { id }, data });
  return { ok: true };
}

export async function deleteAccount(me: JWTPayload, id: number): Promise<{ error: string; status: number } | { ok: true }> {
  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, role: true,
      _count: { select: { schoolBookings: true, invoices: true, schoolAllocations: true } },
    },
  });
  if (!target || !ACCOUNT_ROLES.includes(target.role as AccountRole)) return { error: 'Kontot hittades inte', status: 404 };
  const denied = mayManage(me, target);
  if (denied) return { error: denied, status: 403 };
  if (isOwnerEmail(target.email)) return { error: 'Superanvändarens konto kan inte tas bort', status: 400 };
  if (target.id === me.userId) return { error: 'Du kan inte ta bort ditt eget konto', status: 400 };
  if (target.role === 'school' && target._count.schoolBookings + target._count.invoices + target._count.schoolAllocations > 0) {
    return { error: 'Skolan har bokningar eller fakturor och kan inte tas bort – inaktivera den i stället', status: 409 };
  }
  await prisma.user.delete({ where: { id } });
  return { ok: true };
}
