import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

function buildXml(sessions: {
  startTime: Date;
  course: { behorighet: string };
  bookings: { personnummer: string | null }[];
}[]): string {
  const rapporter = sessions.map((session) => {
    const utbDatum = session.startTime.toISOString().split('T')[0];
    const elevRows = session.bookings
      .filter((b) => b.personnummer)
      .map((b) => `        <Elev>\n            <PersonNr>${b.personnummer}</PersonNr>\n            <UtbDatum>${utbDatum}</UtbDatum>\n        </Elev>`)
      .join('\n');
    return `    <Rapport>\n        <Behorighet>${session.course.behorighet || 'B'}</Behorighet>\n${elevRows}\n    </Rapport>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<Rapporter>\n${rapporter}\n</Rapporter>`;
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
        select: { personnummer: true },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  if (sessions.length === 0) return NextResponse.json({ error: 'Inga sessioner idag' }, { status: 400 });

  const xml = buildXml(sessions);
  const datum = now.toISOString().split('T')[0];

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const xmlBase64 = Buffer.from(xml, 'utf-8').toString('base64');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Uppsala Halkbana <info@uppsalahalkbana.se>',
        to: ['result@uppsalahalkbana.se'],
        subject: `Alla kursresultat ${datum}`,
        html: `<p>Bifogat finns alla kursresultat för ${datum} som XML-fil.</p>`,
        attachments: [{ filename: `kursresultat-${datum}.xml`, content: xmlBase64 }],
      }),
    });
    if (!res.ok) console.error('[Email] Resend error (approve-all XML):', await res.text());
  }

  return NextResponse.json({ sent: true, sessionCount: sessions.length });
}
