interface ReceiptEmailData {
  recipientEmail: string;
  recipientName: string;
  bookingId: number;
  transactionId: string;
  courseName: string;
  courseDate: string;
  courseTime: string;
  location: string;
  price: number;
  personnummer?: string | null;
  phone?: string | null;
  customMessage?: string;
}

function buildReceiptHtml(data: ReceiptEmailData): string {
  return `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:#003DA5;padding:32px 32px 24px;text-align:center;">
      <h1 style="color:#FCD116;margin:0;font-size:22px;letter-spacing:-0.5px;">Uppsala Halkbana</h1>
      <p style="color:#93c5fd;margin:8px 0 0;font-size:14px;">Bokningsbekräftelse</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#111827;font-size:16px;margin:0 0 8px;">Hej <strong>${data.recipientName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Din bokning är bekräftad! Nedan hittar du dina bokningsdetaljer.</p>

      <!-- Booking details -->
      <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin-bottom:24px;">
        <h2 style="color:#111827;font-size:16px;margin:0 0 16px;">Bokningsdetaljer</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#6b7280;padding:4px 0;">Boknings-ID:</td><td style="color:#111827;font-weight:600;text-align:right;">#${data.bookingId}</td></tr>
          <tr><td style="color:#6b7280;padding:4px 0;">Kurs:</td><td style="color:#111827;font-weight:600;text-align:right;">${data.courseName}</td></tr>
          <tr><td style="color:#6b7280;padding:4px 0;">Datum:</td><td style="color:#111827;font-weight:600;text-align:right;">${data.courseDate}</td></tr>
          <tr><td style="color:#6b7280;padding:4px 0;">Tid:</td><td style="color:#111827;font-weight:600;text-align:right;">${data.courseTime}</td></tr>
          <tr><td style="color:#6b7280;padding:4px 0;">Plats:</td><td style="color:#111827;font-weight:600;text-align:right;">${data.location}</td></tr>
          ${data.personnummer ? `<tr><td style="color:#6b7280;padding:4px 0;">Personnummer:</td><td style="color:#111827;font-weight:600;text-align:right;">${data.personnummer}</td></tr>` : ''}
          ${data.phone ? `<tr><td style="color:#6b7280;padding:4px 0;">Telefon:</td><td style="color:#111827;font-weight:600;text-align:right;">${data.phone}</td></tr>` : ''}
          <tr style="border-top:1px solid #e5e7eb;"><td style="color:#111827;font-weight:700;padding:12px 0 4px;">Totalt betalt:</td><td style="color:#003DA5;font-weight:700;font-size:16px;text-align:right;padding:12px 0 4px;">${data.price.toLocaleString('sv-SE')} kr</td></tr>
        </table>
      </div>

      ${data.customMessage ? `
      <!-- Custom message from admin -->
      <div style="border-left:4px solid #003DA5;padding:12px 16px;background:#eff6ff;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;color:#1e40af;font-size:14px;">${data.customMessage}</p>
      </div>
      ` : ''}

      <p style="color:#6b7280;font-size:12px;margin:0;">Transaktions-ID: ${data.transactionId}</p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Uppsala Halkbana · info@uppsalahalkbana.se</p>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">Detta är ett automatiskt meddelande, vänligen svara inte på detta mail.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendReceiptEmail(data: ReceiptEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Email] No RESEND_API_KEY set — skipping email for booking #' + data.bookingId);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Uppsala Halkbana <noreply@uppsalahalkbana.se>',
        to: [data.recipientEmail],
        subject: `Bokningsbekräftelse #${data.bookingId} – Uppsala Halkbana`,
        html: buildReceiptHtml(data),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Email] Resend error:', err);
    }
  } catch (err) {
    console.error('[Email] Failed to send receipt email:', err);
  }
}
