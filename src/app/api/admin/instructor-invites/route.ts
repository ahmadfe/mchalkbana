import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function generatePassword(): string {
  const words = ['Halk', 'Risk', 'Kurs', 'Safe', 'Drive', 'Skol'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  const special = ['!', '#', '@', '*'][Math.floor(Math.random() * 4)];
  const tail = crypto.randomBytes(2).toString('hex');
  return `${word}${num}${special}${tail}`;
}

async function sendInstructorCredentialsEmail(data: { email: string; name: string; password: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log('[Email] No RESEND_API_KEY — skipping instructor credentials email'); return; }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://uppsalahalkbana.se';
  const html = `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;">
    <div style="background:#111827;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
      <img src="https://uppsalahalkbana.se/logo.png" alt="Uppsala Halkbana" width="80" height="80"
        style="border-radius:12px;object-fit:contain;background:#fff;padding:4px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:0.5px;">UPPSALA HALKBANA</h1>
    </div>
    <div style="background:#00C4D4;padding:14px 32px;text-align:center;">
      <p style="color:#fff;margin:0;font-size:15px;font-weight:700;letter-spacing:0.5px;">✓ &nbsp;INSTRUKTÖRSKONTO SKAPAT</p>
    </div>
    <div style="background:#fff;padding:32px;">
      <p style="color:#111827;font-size:16px;margin:0 0 4px;">Hej <strong>${data.name}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px;">Ditt instruktörskonto på Uppsala Halkbana är skapat. Logga in med uppgifterna nedan.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="color:#00C4D4;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;font-weight:700;">Inloggningsuppgifter</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#6b7280;padding:5px 0;width:40%;">E-post</td><td style="color:#111827;font-weight:600;text-align:right;">${data.email}</td></tr>
          <tr><td style="color:#6b7280;padding:5px 0;">Lösenord</td><td style="color:#111827;font-weight:700;text-align:right;font-family:monospace;font-size:16px;">${data.password}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${baseUrl}/sv/login" target="_blank"
          style="display:inline-block;background:#00C4D4;color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">
          Logga in nu
        </a>
      </div>
      <div style="border-left:4px solid #00C4D4;padding:12px 16px;background:#f0fbfc;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;color:#0891a0;font-size:13px;">Byt gärna lösenord efter första inloggningen.</p>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:0;">Frågor? Kontakta oss på <a href="mailto:info@uppsalahalkbana.se" style="color:#00C4D4;">info@uppsalahalkbana.se</a> eller ring 07 07 66 66 61.</p>
    </div>
    <div style="background:#111827;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Uppsala Halkbana · Norrlövsta 147, 747 91 Alunda</p>
      <p style="color:#4b5563;font-size:11px;margin:8px 0 0;">Detta är ett automatiskt meddelande, vänligen svara inte på detta mail.</p>
    </div>
  </div>
</body>
</html>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Uppsala Halkbana <info@uppsalahalkbana.se>',
        to: [data.email],
        subject: 'Ditt instruktörskonto på Uppsala Halkbana',
        html,
      }),
    });
    if (!res.ok) console.error('[Email] Resend error (instructor credentials):', await res.text());
    else console.log('[Email] Instructor credentials sent to', data.email);
  } catch (err) {
    console.error('[Email] Failed to send instructor credentials:', err);
  }
}

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const invites = await prisma.instructorInvite.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ invites });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const { email, name } = await request.json();
  if (!email || !name) return NextResponse.json({ error: 'E-post och namn krävs' }, { status: 400 });

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return NextResponse.json({ error: 'Kontot finns redan' }, { status: 409 });

  const plainPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.create({
    data: { name, email: normalizedEmail, password: hashedPassword, role: 'instructor' },
  });

  // Log invite for audit trail
  const token = crypto.randomBytes(16).toString('hex');
  const invite = await prisma.instructorInvite.create({
    data: { token, email: normalizedEmail, name, usedAt: new Date(), expiresAt: new Date() },
  });

  await sendInstructorCredentialsEmail({ email: normalizedEmail, name, password: plainPassword });

  return NextResponse.json({ invite, user: { id: user.id, name: user.name, email: user.email }, password: plainPassword });
}
