import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateWhatsappApiKey } from '@/lib/whatsapp-auth';

// GET /api/whatsapp/appointments?phone=+46701234567
// Returns bookings for a phone number (guest view)
export async function GET(request: Request) {
  if (!validateWhatsappApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

  const bookings = await prisma.booking.findMany({
    where: {
      guestPhone: phone,
      status: { not: 'Canceled' },
    },
    include: {
      session: { include: { course: true, school: true } },
    },
    orderBy: { bookingTime: 'desc' },
    take: 5,
  });

  const formatted = bookings.map((b) => {
    const start = new Date(b.session.startTime);
    const end = new Date(b.session.endTime);
    const date = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
    const time = `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
    const statusEmoji = b.status === 'Paid' ? '✅' : b.status === 'Confirmed' ? '📋' : '⏳';
    return {
      id: b.id,
      courseName: b.session.course.titleSv,
      courseNameEn: b.session.course.titleEn,
      date,
      time,
      location: b.session.course.location || b.session.school.name,
      status: b.status,
      statusEmoji,
      price: b.session.course.price,
      lineSv: `${statusEmoji} Bokning #${b.id} — ${b.session.course.titleSv}\n   📅 ${date} · ${time}\n   📍 ${b.session.course.location || b.session.school.name}\n   Status: ${b.status}`,
      lineEn: `${statusEmoji} Booking #${b.id} — ${b.session.course.titleEn}\n   📅 ${date} · ${time}\n   📍 ${b.session.course.location || b.session.school.name}\n   Status: ${b.status}`,
    };
  });

  return NextResponse.json({ bookings: formatted });
}
