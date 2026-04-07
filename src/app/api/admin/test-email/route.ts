import { NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY saknas i Vercel miljövariabler.' }, { status: 500 });
  }

  const { to } = await request.json();
  if (!to) return NextResponse.json({ error: 'E-postadress krävs' }, { status: 400 });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Uppsala Halkbana <info@uppsalahalkbana.se>',
      to: [to],
      subject: 'Testmail – Uppsala Halkbana',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:32px auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
          <h2 style="color:#003DA5;margin:0 0 16px;">Uppsala Halkbana – Testmail</h2>
          <p style="color:#374151;">Om du ser detta mail fungerar e-postsystemet korrekt!</p>
          <p style="color:#6b7280;font-size:13px;margin-top:24px;">Skickat från: info@uppsalahalkbana.se via Resend</p>
        </div>
      `,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: `Resend fel: ${JSON.stringify(data)}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
