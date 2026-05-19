import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

function buildXml(session: {
  startTime: Date;
  endTime: Date;
  course: { titleSv: string; behorighet: string };
  bookings: {
    id: number;
    guestName: string | null;
    personnummer: string | null;
    guestPhone: string | null;
    guestEmail: string | null;
    result: string | null;
    resultNote: string | null;
    user: { name: string; phone: string | null; email: string } | null;
  }[];
}): string {
  const datum = session.startTime.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const tid = `${session.startTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}–${session.endTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
  const kurs = `${session.course.titleSv} (${session.course.behorighet})`;

  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const students = session.bookings.map((b) => {
    const namn = escape(b.guestName || b.user?.name || '');
    const pnr = escape(b.personnummer || '');
    const tel = escape(b.guestPhone || b.user?.phone || '');
    const email = escape(b.guestEmail || b.user?.email || '');
    const resultat = b.result === 'passed' ? 'Godkänd' : b.result === 'failed' ? 'Underkänd' : 'Ej bedömd';
    const notering = escape(b.resultNote || '');
    return `    <Student>\n      <Namn>${namn}</Namn>\n      <Personnummer>${pnr}</Personnummer>\n      <Telefon>${tel}</Telefon>\n      <Email>${email}</Email>\n      <Resultat>${resultat}</Resultat>\n      <Notering>${notering}</Notering>\n    </Student>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<KursResultat datum="${datum}" tid="${tid}" kurs="${escape(kurs)}">\n  <Studenter>\n${students}\n  </Studenter>\n</KursResultat>`;
}

async function sendXmlEmail(xml: string, subject: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log('[Email] No RESEND_API_KEY — skipping XML result email'); return; }
  const xmlBase64 = Buffer.from(xml, 'utf-8').toString('base64');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Uppsala Halkbana <info@uppsalahalkbana.se>',
      to: ['result@uppsalahalkbana.se'],
      subject,
      html: `<p>Bifogat finns kursresultaten som XML-fil.</p>`,
      attachments: [{ filename: 'kursresultat.xml', content: xmlBase64 }],
    }),
  });
  if (!res.ok) console.error('[Email] Resend error (XML result):', await res.text());
  else console.log('[Email] XML result email sent');
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'instructor') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const sessionId = parseInt(params.id);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      course: { select: { titleSv: true, behorighet: true } },
      assignedSchoolUsers: { select: { id: true } },
      bookings: {
        where: { status: { not: 'Canceled' } },
        select: {
          id: true,
          guestName: true,
          personnummer: true,
          guestPhone: true,
          guestEmail: true,
          result: true,
          resultNote: true,
          user: { select: { name: true, phone: true, email: true } },
        },
      },
    },
  });

  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });

  const isAssigned = session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  if (!isAssigned) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const xml = buildXml(session);
  const datum = session.startTime.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(/\//g, '-');
  const filename = `kursresultat-${datum}.xml`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'instructor') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const sessionId = parseInt(params.id);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      course: { select: { titleSv: true, behorighet: true } },
      assignedSchoolUsers: { select: { id: true } },
      bookings: {
        where: { status: { not: 'Canceled' } },
        select: {
          id: true,
          guestName: true,
          personnummer: true,
          guestPhone: true,
          guestEmail: true,
          result: true,
          resultNote: true,
          user: { select: { name: true, phone: true, email: true } },
        },
      },
    },
  });

  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });

  const isAssigned = session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  if (!isAssigned) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const xml = buildXml(session);
  const datum = session.startTime.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  await sendXmlEmail(xml, `Kursresultat – ${session.course.titleSv} (${datum})`);

  return NextResponse.json({ sent: true });
}
