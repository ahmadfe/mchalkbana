interface InvoiceEmailData {
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

function buildInvoiceHtml(data: InvoiceEmailData): string {
  const invoiceNumber = `UH-${new Date().getFullYear()}-${String(data.bookingId).padStart(5, '0')}`;
  const issuedDate = new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.12);">

    <!-- Header -->
    <div style="background:#003DA5;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <h1 style="color:#FCD116;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Uppsala Halkbana</h1>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:12px;">Industrigatan 12, 753 30 Uppsala</p>
        <p style="color:#93c5fd;margin:2px 0 0;font-size:12px;">info@ihalka.se · 018-123 45 67</p>
      </div>
      <div style="text-align:right;">
        <p style="color:#fff;margin:0;font-size:18px;font-weight:700;">FAKTURA</p>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:12px;">${invoiceNumber}</p>
      </div>
    </div>

    <!-- Invoice meta -->
    <div style="padding:24px 32px 0;display:flex;justify-content:space-between;border-bottom:1px solid #f3f4f6;padding-bottom:20px;">
      <div>
        <p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Faktura till</p>
        <p style="color:#111827;font-size:15px;font-weight:600;margin:0;">${data.recipientName}</p>
        ${data.personnummer ? `<p style="color:#6b7280;font-size:13px;margin:2px 0 0;">${data.personnummer}</p>` : ''}
        ${data.phone ? `<p style="color:#6b7280;font-size:13px;margin:2px 0 0;">${data.phone}</p>` : ''}
        <p style="color:#6b7280;font-size:13px;margin:2px 0 0;">${data.recipientEmail}</p>
      </div>
      <div style="text-align:right;">
        <p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Fakturadatum</p>
        <p style="color:#111827;font-size:13px;font-weight:600;margin:0;">${issuedDate}</p>
        <p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 4px;">Boknings-ID</p>
        <p style="color:#111827;font-size:13px;font-weight:600;margin:0;">#${data.bookingId}</p>
      </div>
    </div>

    <!-- Line items -->
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb;">
            <th style="text-align:left;color:#6b7280;font-weight:600;padding:0 0 10px;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;">Tjänst</th>
            <th style="text-align:left;color:#6b7280;font-weight:600;padding:0 0 10px;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;">Datum</th>
            <th style="text-align:left;color:#6b7280;font-weight:600;padding:0 0 10px;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;">Plats</th>
            <th style="text-align:right;color:#6b7280;font-weight:600;padding:0 0 10px;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;">Belopp</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:14px 0;color:#111827;font-weight:600;">${data.courseName}</td>
            <td style="padding:14px 0;color:#374151;">${data.courseDate}<br/><span style="color:#6b7280;font-size:12px;">kl. ${data.courseTime}</span></td>
            <td style="padding:14px 0;color:#374151;">${data.location}</td>
            <td style="padding:14px 0;color:#111827;font-weight:700;text-align:right;">${data.price.toLocaleString('sv-SE')} kr</td>
          </tr>
        </tbody>
      </table>

      <!-- Total -->
      <div style="border-top:2px solid #003DA5;margin-top:8px;padding-top:16px;display:flex;justify-content:flex-end;">
        <table style="font-size:13px;">
          <tr>
            <td style="color:#6b7280;padding:4px 24px 4px 0;">Delsumma (inkl. moms):</td>
            <td style="color:#111827;font-weight:600;text-align:right;">${data.price.toLocaleString('sv-SE')} kr</td>
          </tr>
          <tr>
            <td style="color:#111827;font-weight:700;font-size:15px;padding:8px 24px 0 0;">Totalt betalt:</td>
            <td style="color:#003DA5;font-weight:700;font-size:16px;text-align:right;padding-top:8px;">${data.price.toLocaleString('sv-SE')} kr</td>
          </tr>
        </table>
      </div>

      <!-- Status badge -->
      <div style="margin-top:20px;text-align:center;">
        <span style="display:inline-block;background:#dcfce7;color:#166534;font-weight:700;font-size:13px;padding:8px 20px;border-radius:20px;letter-spacing:0.3px;">✓ BETALD</span>
      </div>

      ${data.customMessage ? `
      <!-- Custom message -->
      <div style="border-left:4px solid #003DA5;padding:12px 16px;background:#eff6ff;border-radius:0 8px 8px 0;margin-top:24px;">
        <p style="margin:0;color:#1e40af;font-size:14px;">${data.customMessage}</p>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">Uppsala Halkbana · Industrigatan 12, 753 30 Uppsala</p>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;text-align:center;">info@ihalka.se · 018-123 45 67</p>
      <p style="color:#d1d5db;font-size:11px;margin:12px 0 0;text-align:center;">Transaktions-ID: ${data.transactionId}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendReceiptEmail(data: InvoiceEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Email] No RESEND_API_KEY set — skipping invoice for booking #' + data.bookingId);
    return;
  }

  const invoiceNumber = `UH-${new Date().getFullYear()}-${String(data.bookingId).padStart(5, '0')}`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Uppsala Halkbana <info@ihalka.se>',
        to: [data.recipientEmail],
        subject: `Faktura ${invoiceNumber} – Uppsala Halkbana`,
        html: buildInvoiceHtml(data),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Email] Resend error:', err);
    } else {
      console.log('[Email] Invoice sent to', data.recipientEmail, 'for booking #' + data.bookingId);
    }
  } catch (err) {
    console.error('[Email] Failed to send invoice:', err);
  }
}
