import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { name, email, subject, message } = await request.json();

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Namn, e-post och meddelande krävs' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Contact] No RESEND_API_KEY — skipping contact email');
    return NextResponse.json({ success: true });
  }

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#111827;padding:20px 28px;">
      <p style="color:#fff;margin:0;font-size:16px;font-weight:700;">📬 Nytt kontaktmeddelande</p>
      <p style="color:#9ca3af;margin:4px 0 0;font-size:13px;">Via uppsalahalkbana.se</p>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
        <tr><td style="color:#6b7280;padding:6px 0;width:30%;">Namn</td><td style="color:#111827;font-weight:600;">${name}</td></tr>
        <tr><td style="color:#6b7280;padding:6px 0;">E-post</td><td style="color:#111827;font-weight:600;"><a href="mailto:${email}" style="color:#00C4D4;">${email}</a></td></tr>
        ${subject ? `<tr><td style="color:#6b7280;padding:6px 0;">Ämne</td><td style="color:#111827;font-weight:600;">${subject}</td></tr>` : ''}
      </table>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;">${message}</p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:14px 28px;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Svara direkt till avsändaren: <a href="mailto:${email}" style="color:#00C4D4;">${email}</a></p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Uppsala Halkbana <info@ihalka.se>',
      to: ['info@uppsalahalkbana.se'],
      reply_to: email,
      subject: subject ? `Kontaktformulär: ${subject}` : `Nytt meddelande från ${name}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error('[Contact] Resend error:', await res.text());
    return NextResponse.json({ error: 'Kunde inte skicka meddelandet' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
