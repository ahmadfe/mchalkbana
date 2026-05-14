import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

function buildXml(sessions: {
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
}[]): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const sessionsXml = sessions.map((session) => {
    const datum = session.startTime.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    const tid = `${session.startTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}–${session.endTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}`;
    const kurs = `${session.course.titleSv} (${session.course.behorighet})`;

    const students = session.bookings.map((b) => {
      const namn = escape(b.guestName || b.user?.name || '');
      const pnr = escape(b.personnummer || '');
      const tel = escape(b.guestPhone || b.user?.phone || '');
      const email = escape(b.guestEmail || b.user?.email || '');
      const resultat = b.result === 'passed' ? 'Godkänd' : b.result === 'failed' ? 'Underkänd' : 'Ej bedömd';
      const notering = escape(b.resultNote || '');
      return `      <Student>\n        <Namn>${namn}</Namn>\n        <Personnummer>${pnr}</Personnummer>\n        <Telefon>${tel}</Telefon>\n        <Email>${email}</Email>\n        <Resultat>${resultat}</Resultat>\n        <Notering>${notering}</Notering>\n      </Student>`;
    }).join('\n');

    return `  <Session datum="${datum}" tid="${tid}" kurs="${escape(kurs)}">\n    <Studenter>\n${students}\n    </Studenter>\n  </Session>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<DagensKursresultat>\n${sessionsXml}\n</DagensKursresultat>`;
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser || authUser.role !== 'instructor') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const sessions = await prisma.session.findMany({
    where: {
      startTime: { gte: todayStart, lte: todayEnd },
      assignedSchoolUsers: { some: { id: authUser.userId } },
    },
    include: {
      course: { select: { titleSv: true, behorighet: true } },
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
    orderBy: { startTime: 'asc' },
  });

  if (sessions.length === 0) return NextResponse.json({ error: 'Inga sessioner idag' }, { status: 400 });

  const xml = buildXml(sessions);
  const datum = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const xmlBase64 = Buffer.from(xml, 'utf-8').toString('base64');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Uppsala Halkbana <info@uppsalahalkbana.se>',
        to: ['admin@uppsalahalkbana.se'],
        subject: `Alla kursresultat ${datum}`,
        html: `<p>Bifogat finns alla kursresultat för ${datum} som XML-fil.</p>`,
        attachments: [{ filename: `kursresultat-${datum}.xml`, content: xmlBase64 }],
      }),
    });
    if (!res.ok) console.error('[Email] Resend error (approve-all XML):', await res.text());
  }

  return NextResponse.json({ sent: true, sessionCount: sessions.length });
}
