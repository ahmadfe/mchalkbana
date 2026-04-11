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

  const emailSubject = subject
    ? `Meddelande från ${name}: ${subject}`
    : `Meddelande från ${name} via kontaktformuläret`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;">

    <!-- Header -->
    <div style="background:#111827;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
      <img src="https://ihalka.se/logo.png" alt="Uppsala Halkbana" width="80" height="80"
        style="border-radius:12px;object-fit:contain;background:#fff;padding:4px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:0.5px;">UPPSALA HALKBANA</h1>
    </div>

    <!-- Banner -->
    <div style="background:#00C4D4;padding:14px 32px;text-align:center;">
      <p style="color:#fff;margin:0;font-size:15px;font-weight:700;letter-spacing:0.5px;">✉️ &nbsp;NYTT KONTAKTMEDDELANDE</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;">
      <p style="color:#6b7280;font-size:13px;margin:0 0 24px;">Mottaget via kontaktformuläret på uppsalahalkbana.se</p>

      <!-- Sender details -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="color:#00C4D4;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;font-weight:700;">Avsändare</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="color:#6b7280;padding:5px 0;width:35%;">Namn</td>
            <td style="color:#111827;font-weight:600;text-align:right;">${name}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">E-post</td>
            <td style="text-align:right;"><a href="mailto:${email}" style="color:#00C4D4;font-weight:600;text-decoration:none;">${email}</a></td>
          </tr>
          ${subject ? `<tr><td style="color:#6b7280;padding:5px 0;">Ämne</td><td style="color:#111827;font-weight:600;text-align:right;">${subject}</td></tr>` : ''}
        </table>
      </div>

      <!-- Message -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
        <p style="color:#00C4D4;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;font-weight:700;">Meddelande</p>
        <p style="color:#374151;font-size:14px;line-height:1.8;margin:0;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>

      <!-- Reply CTA -->
      <div style="text-align:center;margin-top:28px;">
        <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject || `Ditt meddelande`)}"
          style="display:inline-block;background:#00C4D4;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
          Svara till ${name}
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#111827;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Uppsala Halkbana · Norrlövsta 147, 747 91 Alunda</p>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">info@uppsalahalkbana.se · 07 07 66 66 61</p>
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
      subject: emailSubject,
      html,
    }),
  });

  if (!res.ok) {
    console.error('[Contact] Resend error:', await res.text());
    return NextResponse.json({ error: 'Kunde inte skicka meddelandet' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
