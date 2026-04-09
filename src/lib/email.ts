interface ReceiptEmailData {
  recipientEmail: string;
  recipientName: string;
  bookingId: number;
  transactionId: string;
  courseName: string;
  courseDate: string;
  courseTime: string;
  location: string;
  price: number; // total inkl. 25% moms
  startTimeIso: string; // for Google Calendar
  endTimeIso: string;   // for Google Calendar
  personnummer?: string | null;
  phone?: string | null;
  customMessage?: string;
}

function toGCalDate(iso: string): string {
  // Format: YYYYMMDDTHHmmssZ
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function buildReceiptHtml(data: ReceiptEmailData): string {
  const receiptNumber = `UH-${new Date().getFullYear()}-${String(data.bookingId).padStart(5, '0')}`;
  const issuedDate = new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

  // VAT breakdown (price is total inkl. 25% moms)
  const priceExVat = Math.round(data.price / 1.25);
  const vatAmount = data.price - priceExVat;

  // Google Calendar URL
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE`
    + `&text=${encodeURIComponent('Uppsala Halkbana – ' + data.courseName)}`
    + `&dates=${toGCalDate(data.startTimeIso)}/${toGCalDate(data.endTimeIso)}`
    + `&details=${encodeURIComponent('Boknings-ID: #' + data.bookingId + '\nKvitto: ' + receiptNumber)}`
    + `&location=${encodeURIComponent(data.location + ', Uppsala')}`;

  return `
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

    <!-- Status banner -->
    <div style="background:#0ABCCE;padding:14px 32px;text-align:center;">
      <p style="color:#fff;margin:0;font-size:15px;font-weight:700;letter-spacing:0.5px;">✓ &nbsp;BETALNING BEKRÄFTAD</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;">

      <p style="color:#111827;font-size:16px;margin:0 0 4px;">Hej <strong>${data.recipientName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px;">Tack för din bokning! Nedan hittar du ditt kvitto.</p>

      <!-- Receipt meta -->
      <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
        <div>
          <p style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 3px;">Kvittonummer</p>
          <p style="color:#111827;font-size:14px;font-weight:700;margin:0;">${receiptNumber}</p>
        </div>
        <div style="text-align:right;">
          <p style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 3px;">Datum</p>
          <p style="color:#111827;font-size:14px;font-weight:600;margin:0;">${issuedDate}</p>
        </div>
      </div>

      <!-- Course details card -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="color:#0ABCCE;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;font-weight:700;">Kursdetaljer</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="color:#6b7280;padding:5px 0;width:40%;">Kurs</td>
            <td style="color:#111827;font-weight:600;text-align:right;">${data.courseName}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Datum</td>
            <td style="color:#111827;font-weight:600;text-align:right;">${data.courseDate}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Tid</td>
            <td style="color:#111827;font-weight:600;text-align:right;">${data.courseTime}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Plats</td>
            <td style="color:#111827;font-weight:600;text-align:right;">${data.location}</td>
          </tr>
          ${data.personnummer ? `<tr><td style="color:#6b7280;padding:5px 0;">Personnummer</td><td style="color:#111827;font-weight:600;text-align:right;">${data.personnummer}</td></tr>` : ''}
          ${data.phone ? `<tr><td style="color:#6b7280;padding:5px 0;">Telefon</td><td style="color:#111827;font-weight:600;text-align:right;">${data.phone}</td></tr>` : ''}
          ${data.customMessage ? `<tr><td style="color:#dc2626;padding:8px 0 5px;font-weight:700;">OBS!</td><td style="color:#dc2626;font-weight:600;text-align:right;padding:8px 0 5px;">${data.customMessage}</td></tr>` : ''}
        </table>
      </div>

      <!-- Price breakdown -->
      <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-bottom:24px;">
        <table style="width:100%;font-size:14px;">
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Pris exkl. moms</td>
            <td style="color:#374151;text-align:right;">${priceExVat.toLocaleString('sv-SE')} kr</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Moms (25%)</td>
            <td style="color:#374151;text-align:right;">${vatAmount.toLocaleString('sv-SE')} kr</td>
          </tr>
          <tr style="border-top:2px solid #0ABCCE;">
            <td style="color:#111827;font-weight:700;font-size:16px;padding:12px 0 4px;">Totalt betalt</td>
            <td style="color:#0ABCCE;font-weight:700;font-size:18px;text-align:right;padding:12px 0 4px;">${data.price.toLocaleString('sv-SE')} kr</td>
          </tr>
        </table>
      </div>

      <!-- Google Calendar button -->
      <div style="text-align:center;margin-top:8px;">
        <a href="${gcalUrl}" target="_blank"
          style="display:inline-block;background:#111827;color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">
          📅 &nbsp;Lägg till i Google Kalender
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:10px 0 0;">Klicka på knappen för att spara kursdatumet i din kalender.</p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#111827;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Uppsala Halkbana · Norrlövsta 147, 747 91 Alunda</p>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">info@uppsalahalkbana.se · 07 07 66 66 61</p>
      <p style="color:#4b5563;font-size:11px;margin:12px 0 0;">Transaktions-ID: ${data.transactionId}</p>
      <p style="color:#4b5563;font-size:11px;margin:4px 0 0;">Detta är ett automatiskt meddelande, vänligen svara inte på detta mail.</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Admin-added booking confirmation (no payment) ──────────────────────────

interface BookingConfirmationEmailData {
  recipientEmail: string;
  recipientName: string;
  bookingId: number;
  courseName: string;
  courseDate: string;
  courseTime: string;
  location: string;
  schoolName?: string | null;
  personnummer?: string | null;
  phone?: string | null;
}

function buildBookingConfirmationHtml(data: BookingConfirmationEmailData): string {
  return `
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

    <!-- Status banner -->
    <div style="background:#0ABCCE;padding:14px 32px;text-align:center;">
      <p style="color:#fff;margin:0;font-size:15px;font-weight:700;letter-spacing:0.5px;">✓ &nbsp;BOKNING BEKRÄFTAD</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;">
      <p style="color:#111827;font-size:16px;margin:0 0 4px;">Hej <strong>${data.recipientName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px;">Din plats är bokad. Nedan hittar du en sammanfattning av din bokning.</p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="color:#0ABCCE;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;font-weight:700;">Bokningsdetaljer</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#6b7280;padding:5px 0;width:40%;">Kurs</td><td style="color:#111827;font-weight:600;text-align:right;">${data.courseName}</td></tr>
          <tr><td style="color:#6b7280;padding:5px 0;">Datum</td><td style="color:#111827;font-weight:600;text-align:right;">${data.courseDate}</td></tr>
          <tr><td style="color:#6b7280;padding:5px 0;">Tid</td><td style="color:#111827;font-weight:600;text-align:right;">${data.courseTime}</td></tr>
          <tr><td style="color:#6b7280;padding:5px 0;">Plats</td><td style="color:#111827;font-weight:600;text-align:right;">${data.location}</td></tr>
          ${data.schoolName ? `<tr><td style="color:#6b7280;padding:5px 0;">Trafikskola</td><td style="color:#111827;font-weight:600;text-align:right;">${data.schoolName}</td></tr>` : ''}
          ${data.personnummer ? `<tr><td style="color:#6b7280;padding:5px 0;">Personnummer</td><td style="color:#111827;font-weight:600;text-align:right;">${data.personnummer}</td></tr>` : ''}
          ${data.phone ? `<tr><td style="color:#6b7280;padding:5px 0;">Telefon</td><td style="color:#111827;font-weight:600;text-align:right;">${data.phone}</td></tr>` : ''}
        </table>
      </div>

      <p style="color:#6b7280;font-size:13px;margin:0;">Vid frågor, kontakta oss på <a href="mailto:info@uppsalahalkbana.se" style="color:#0ABCCE;">info@uppsalahalkbana.se</a> eller ring 07 07 66 66 61.</p>
    </div>

    <!-- Footer -->
    <div style="background:#111827;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Uppsala Halkbana · Norrlövsta 147, 747 91 Alunda</p>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">info@uppsalahalkbana.se · 07 07 66 66 61</p>
      <p style="color:#4b5563;font-size:11px;margin:12px 0 0;">Detta är ett automatiskt meddelande, vänligen svara inte på detta mail.</p>
    </div>

  </div>
</body>
</html>`;
}

export async function sendBookingConfirmationEmail(data: BookingConfirmationEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Email] No RESEND_API_KEY — skipping booking confirmation for #' + data.bookingId);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Uppsala Halkbana <info@ihalka.se>',
        to: [data.recipientEmail],
        subject: `Bokningsbekräftelse för ${data.courseName} på Uppsala Halkbana`,
        html: buildBookingConfirmationHtml(data),
      }),
    });
    if (!res.ok) console.error('[Email] Resend error:', await res.text());
    else console.log('[Email] Booking confirmation sent to', data.recipientEmail);
  } catch (err) {
    console.error('[Email] Failed to send booking confirmation:', err);
  }
}

// ── School account credentials ─────────────────────────────────────────────

interface SchoolAccountEmailData {
  schoolName: string;
  email: string;
  password: string;
}

function buildSchoolAccountHtml(data: SchoolAccountEmailData): string {
  return `
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

    <!-- Status banner -->
    <div style="background:#0ABCCE;padding:14px 32px;text-align:center;">
      <p style="color:#fff;margin:0;font-size:15px;font-weight:700;letter-spacing:0.5px;">✓ &nbsp;KONTO SKAPAT</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;">
      <p style="color:#111827;font-size:16px;margin:0 0 4px;">Hej <strong>${data.schoolName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px;">Ditt konto på Uppsala Halkbanas trafikskolaportal har skapats. Nedan hittar du dina inloggningsuppgifter.</p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="color:#0ABCCE;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;font-weight:700;">Inloggningsuppgifter</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#6b7280;padding:5px 0;width:40%;">E-post</td><td style="color:#111827;font-weight:600;text-align:right;">${data.email}</td></tr>
          <tr><td style="color:#6b7280;padding:5px 0;">Lösenord</td><td style="color:#111827;font-weight:600;text-align:right;font-family:monospace;">${data.password}</td></tr>
        </table>
      </div>

      <div style="border-left:4px solid #0ABCCE;padding:12px 16px;background:#f0fbfc;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;color:#0891a0;font-size:14px;">Byt lösenord efter första inloggningen av säkerhetsskäl.</p>
      </div>

      <p style="color:#6b7280;font-size:13px;margin:0;">Vid frågor, kontakta oss på <a href="mailto:info@uppsalahalkbana.se" style="color:#0ABCCE;">info@uppsalahalkbana.se</a> eller ring 07 07 66 66 61.</p>
    </div>

    <!-- Footer -->
    <div style="background:#111827;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Uppsala Halkbana · Norrlövsta 147, 747 91 Alunda</p>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">info@uppsalahalkbana.se · 07 07 66 66 61</p>
      <p style="color:#4b5563;font-size:11px;margin:12px 0 0;">Detta är ett automatiskt meddelande, vänligen svara inte på detta mail.</p>
    </div>

  </div>
</body>
</html>`;
}

export async function sendSchoolAccountEmail(data: SchoolAccountEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Email] No RESEND_API_KEY — skipping school account email for', data.email);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Uppsala Halkbana <info@ihalka.se>',
        to: [data.email],
        subject: 'Ditt konto på Uppsala Halkbana är skapat',
        html: buildSchoolAccountHtml(data),
      }),
    });
    if (!res.ok) console.error('[Email] Resend error:', await res.text());
    else console.log('[Email] School account email sent to', data.email);
  } catch (err) {
    console.error('[Email] Failed to send school account email:', err);
  }
}

// ── School monthly invoice ─────────────────────────────────────────────────

interface SchoolInvoiceEmailData {
  recipientEmail: string;
  schoolName: string;
  customerNumber: number;
  month: string; // e.g. "april 2026"
  rows: {
    courseName: string;
    sessionDate: string;
    studentCount: number;
    pricePerStudent: number;
    subtotal: number;
  }[];
  totalStudents: number;
  totalAmount: number;
}

function buildSchoolInvoiceHtml(data: SchoolInvoiceEmailData): string {
  const now = new Date();
  const invoiceNumber = String(data.customerNumber).padStart(3, '0') + String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
  const fakturadatum = now.toLocaleDateString('sv-SE').replace(/\//g, '-');
  const dueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE').replace(/\//g, '-');
  const priceExVat = Math.round(data.totalAmount / 1.25);
  const vatAmount = data.totalAmount - priceExVat;

  const rowsHtml = data.rows.map((r) => `
    <tr>
      <td style="padding:10px 12px;font-size:14px;color:#111827;border-bottom:1px solid #f3f4f6;">${r.courseName} (${r.sessionDate})</td>
      <td style="padding:10px 8px;font-size:14px;color:#111827;text-align:center;border-bottom:1px solid #f3f4f6;">${r.studentCount}</td>
      <td style="padding:10px 8px;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;">${r.pricePerStudent.toLocaleString('sv-SE')} kr</td>
      <td style="padding:10px 8px;font-size:14px;color:#6b7280;text-align:center;border-bottom:1px solid #f3f4f6;"></td>
      <td style="padding:10px 12px;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;">${r.subtotal.toLocaleString('sv-SE')} kr</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
<div style="max-width:680px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header: company name left, FAKTURA right -->
  <div style="padding:28px 36px 20px;border-bottom:1px solid #e5e7eb;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0ABCCE;line-height:1.2;">Consult Centre</p>
          <p style="margin:0;font-size:22px;font-weight:700;color:#0ABCCE;line-height:1.4;">Scandinavia AB</p>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <p style="margin:0;font-size:30px;font-weight:900;color:#0ABCCE;letter-spacing:2px;">FAKTURA</p>
          <div style="height:2px;background:#0ABCCE;margin-top:6px;"></div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Invoice details + billing address -->
  <div style="padding:24px 36px;border-bottom:1px solid #e5e7eb;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <!-- Left: invoice meta -->
        <td style="vertical-align:top;width:45%;">
          <table style="border-collapse:collapse;font-size:13px;">
            <tr><td style="color:#374151;font-weight:700;padding:2px 12px 2px 0;white-space:nowrap;">Fakturanr</td><td style="color:#111827;">${invoiceNumber}</td></tr>
            <tr><td style="color:#374151;font-weight:700;padding:2px 12px 2px 0;">Kund nr</td><td style="color:#111827;">${data.customerNumber}</td></tr>
            <tr><td style="color:#374151;font-weight:700;padding:2px 12px 2px 0;">Fakturadatum</td><td style="color:#111827;">${fakturadatum}</td></tr>
            <tr><td style="color:#374151;font-weight:700;padding:2px 12px 2px 0;">Betalningsvillkor</td><td style="color:#111827;">10 dagar</td></tr>
            <tr><td style="color:#374151;font-weight:700;padding:2px 12px 2px 0;">Förfallodatum</td><td style="color:#111827;">${dueDate}</td></tr>
          </table>
          <p style="font-size:11px;color:#6b7280;margin:12px 0 0;">Efter förfallodagen debiteras ränta enligt räntelagen</p>
        </td>
        <!-- Middle: referens -->
        <td style="vertical-align:top;width:25%;padding-left:16px;">
          <p style="font-size:12px;font-weight:700;color:#374151;margin:0 0 4px;">Vår referens</p>
          <p style="font-size:13px;color:#111827;margin:0;">Uppsala Halkbana</p>
        </td>
        <!-- Right: billing address box -->
        <td style="vertical-align:top;width:30%;padding-left:8px;">
          <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
            <div style="background:#0ABCCE;padding:6px 12px;">
              <p style="color:#fff;font-size:12px;font-weight:700;margin:0;">Faktureringsadress</p>
            </div>
            <div style="padding:10px 12px;">
              <p style="font-size:14px;font-weight:700;color:#111827;margin:0;">${data.schoolName}</p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Products table -->
  <div style="padding:0 36px 24px;">
    <table style="width:100%;border-collapse:collapse;margin-top:24px;">
      <thead>
        <tr style="background:#0ABCCE;">
          <th style="padding:10px 12px;text-align:left;color:#fff;font-size:13px;font-weight:700;">Produkt / tjänst</th>
          <th style="padding:10px 8px;text-align:center;color:#fff;font-size:13px;font-weight:700;">Antal</th>
          <th style="padding:10px 8px;text-align:right;color:#fff;font-size:13px;font-weight:700;">À pris</th>
          <th style="padding:10px 8px;text-align:center;color:#fff;font-size:13px;font-weight:700;">Rb</th>
          <th style="padding:10px 12px;text-align:right;color:#fff;font-size:13px;font-weight:700;">Belopp</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>

  <!-- Watermark logo + totals -->
  <div style="padding:0 36px 32px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <!-- Logo watermark -->
        <td style="vertical-align:middle;width:50%;text-align:center;padding:16px;">
          <img src="https://ihalka.se/logo.png" alt="Uppsala Halkbana" width="120" height="120"
            style="opacity:0.12;object-fit:contain;" />
          <p style="color:#0ABCCE;font-size:16px;font-weight:900;letter-spacing:3px;margin:8px 0 0;opacity:0.3;text-transform:uppercase;">UPPSALAHALKBANA</p>
        </td>
        <!-- Totals -->
        <td style="vertical-align:bottom;width:50%;padding-left:24px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="color:#6b7280;padding:4px 0;">Netto:</td>
              <td style="color:#111827;text-align:right;padding:4px 0;">${priceExVat.toLocaleString('sv-SE')} kr</td>
            </tr>
            <tr>
              <td style="color:#6b7280;padding:4px 0;">Moms 25%:</td>
              <td style="color:#111827;text-align:right;padding:4px 0;">${vatAmount.toLocaleString('sv-SE')} kr</td>
            </tr>
          </table>
          <div style="border-top:2px solid #111827;margin-top:12px;padding-top:12px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="font-size:15px;font-weight:700;color:#111827;">Summa att betala:</td>
                <td style="font-size:18px;font-weight:900;color:#111827;text-align:right;">${data.totalAmount.toLocaleString('sv-SE')} kr</td>
              </tr>
            </table>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 36px;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr>
        <td style="vertical-align:top;padding-right:16px;">
          <p style="font-weight:700;color:#111827;margin:0 0 4px;">Adress</p>
          <p style="color:#6b7280;margin:0;line-height:1.6;">Consult Centre AB<br>Box 13100<br>402 52 GÖTEBORG</p>
        </td>
        <td style="vertical-align:top;padding-right:16px;">
          <p style="font-weight:700;color:#111827;margin:0 0 4px;">Telefon</p>
          <p style="color:#6b7280;margin:0;">0707 66 66 61</p>
        </td>
        <td style="vertical-align:top;padding-right:16px;">
          <p style="font-weight:700;color:#111827;margin:0 0 4px;">Org.nr.</p>
          <p style="color:#6b7280;margin:0;">559188-6410</p>
          <p style="font-weight:700;color:#111827;margin:8px 0 4px;">Momsreg.nr.</p>
          <p style="color:#6b7280;margin:0;">SE559188641001</p>
        </td>
        <td style="vertical-align:top;padding-right:16px;">
          <p style="font-weight:700;color:#111827;margin:0 0 4px;">Webbplats</p>
          <p style="color:#6b7280;margin:0;">uppsalahalkbana.se</p>
          <p style="font-weight:700;color:#111827;margin:8px 0 4px;">Företagets e-post</p>
          <p style="color:#6b7280;margin:0;">info@uppsalahalkbana.se</p>
        </td>
        <td style="vertical-align:top;">
          <p style="font-weight:700;color:#111827;margin:0 0 4px;">Bankgiro</p>
          <p style="color:#6b7280;margin:0;">5335-8925</p>
          <p style="font-weight:700;color:#111827;margin:8px 0 4px;">Swish</p>
          <p style="color:#6b7280;margin:0;">1234 114 112</p>
        </td>
      </tr>
    </table>
    <p style="font-size:11px;color:#6b7280;margin:12px 0 0;">Godkänd för F-skatt</p>
  </div>

  <!-- Bottom bar -->
  <div style="background:#111827;padding:10px 36px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="color:#9ca3af;font-size:12px;"># ${invoiceNumber} #</td>
        <td style="color:#9ca3af;font-size:12px;text-align:center;">${data.totalAmount.toLocaleString('sv-SE').replace(/\s/g,'')} 00 &nbsp; 1 &gt;</td>
        <td style="color:#9ca3af;font-size:12px;text-align:right;">53358925#41#</td>
      </tr>
    </table>
  </div>

</div>
</body>
</html>`;
}

export async function sendSchoolInvoiceEmail(data: SchoolInvoiceEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Email] No RESEND_API_KEY — skipping invoice for', data.recipientEmail);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Uppsala Halkbana <info@ihalka.se>',
        to: [data.recipientEmail],
        subject: `Faktura ${data.month} – Uppsala Halkbana`,
        html: buildSchoolInvoiceHtml(data),
      }),
    });
    if (!res.ok) console.error('[Email] Resend error:', await res.text());
    else console.log('[Email] Invoice sent to', data.recipientEmail);
  } catch (err) {
    console.error('[Email] Failed to send invoice:', err);
  }
}

export async function sendReceiptEmail(data: ReceiptEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Email] No RESEND_API_KEY set — skipping receipt for booking #' + data.bookingId);
    return;
  }

  const receiptNumber = `UH-${new Date().getFullYear()}-${String(data.bookingId).padStart(5, '0')}`;

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
        subject: `Kvitto ${receiptNumber} – Din bokning är bekräftad`,
        html: buildReceiptHtml(data),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Email] Resend error:', err);
    } else {
      console.log('[Email] Receipt sent to', data.recipientEmail, 'for booking #' + data.bookingId);
    }
  } catch (err) {
    console.error('[Email] Failed to send receipt:', err);
  }
}
