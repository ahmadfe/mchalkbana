import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';

// GET /api/whatsapp/sessions
// Returns upcoming public sessions formatted for WhatsApp display
export async function GET(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() + 60 * 60 * 1000); // hide sessions starting within 1h

  const sessions = await prisma.session.findMany({
    where: {
      visibility: 'public',
      startTime: { gt: cutoff },
      seatsAvailable: { gt: 0 },
    },
    include: { course: true, school: true },
    orderBy: { startTime: 'asc' },
    take: 10,
  });

  const formatted = sessions.map((s, i) => {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    const date = start.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
    return {
      index: i + 1,
      id: s.id,
      courseId: s.courseId,
      courseName: s.course.titleSv,
      courseNameEn: s.course.titleEn,
      type: s.course.type,
      vehicle: s.course.vehicle,
      date,
      time,
      startTime: s.startTime,
      seatsAvailable: s.seatsAvailable,
      price: s.price ?? s.course.price,
      location: s.course.location || s.school.name,
      // Pre-formatted line for WhatsApp message
      lineSv: `${i + 1}️⃣  ${date} · ${time} · ${s.seatsAvailable} platser · ${(s.price ?? s.course.price).toLocaleString('sv-SE')} kr`,
      lineEn: `${i + 1}️⃣  ${date} · ${time} · ${s.seatsAvailable} seats · ${(s.price ?? s.course.price).toLocaleString('sv-SE')} SEK`,
    };
  });

  return NextResponse.json({ sessions: formatted });
}
