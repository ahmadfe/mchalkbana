import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

function buildXml(session: {
  startTime: Date;
  course: { behorighet: string };
  bookings: { personnummer: string | null }[];
}): string {
  const utbDatum = session.startTime.toISOString().split('T')[0];
  const elevRows = session.bookings
    .filter((b) => b.personnummer)
    .map((b) => `    <Elev>\n        <PersonNr>${b.personnummer}</PersonNr>\n        <UtbDatum>${utbDatum}</UtbDatum>\n    </Elev>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<Rapport>\n    <Behorighet>${session.course.behorighet || 'B'}</Behorighet>\n${elevRows}\n</Rapport>`;
}

async function sendXmlEmail(xml: string, subject: string, filename: string): Promise<void> {
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
      attachments: [{ filename, content: xmlBase64 }],
    }),
  });
  if (!res.ok) console.error('[Email] Resend error (XML result):', await res.text());
  else console.log('[Email] XML result email sent');
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
        select: { personnummer: true },
      },
    },
  });

  if (!session) return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });

  const isAssigned = session.assignedSchoolUsers.some((u) => u.id === authUser.userId);
  if (!isAssigned) return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const xml = buildXml(session);
  const datum = session.startTime.toISOString().split('T')[0];
  await sendXmlEmail(xml, `Kursresultat – ${session.course.titleSv} (${datum})`, `kursresultat-${datum}.xml`);

  return NextResponse.json({ sent: true });
}
