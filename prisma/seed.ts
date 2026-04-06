import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.session.deleteMany();
  await prisma.course.deleteMany();
  await prisma.school.deleteMany();
  await prisma.user.deleteMany();

  // Schools
  const school1 = await prisma.school.create({
    data: {
      name: 'Uppsala Halkbana',
      address: 'Industrigatan 12, 753 30 Uppsala',
      contactEmail: 'info@uppsalahalkbana.se',
    },
  });

  const school2 = await prisma.school.create({
    data: {
      name: 'Uppsala Trafikcenter',
      address: 'Storgatan 5, 753 20 Uppsala',
      contactEmail: 'kontakt@uppsalatrafikcenter.se',
    },
  });

  // Courses
  const risk1Car = await prisma.course.create({
    data: {
      titleSv: 'Risk 1 – Bil',
      titleEn: 'Risk 1 – Car',
      description: 'Teoretisk utbildning om alkohol, droger och trötthet i trafiken.',
      type: 'Risk1',
      vehicle: 'Car',
      price: 1500,
    },
  });

  const risk2Car = await prisma.course.create({
    data: {
      titleSv: 'Risk 2 – Bil',
      titleEn: 'Risk 2 – Car',
      description: 'Praktisk körning på halkbana – lär dig hantera bilen i svåra vägförhållanden.',
      type: 'Risk2',
      vehicle: 'Car',
      price: 2500,
    },
  });

  const risk1Moto = await prisma.course.create({
    data: {
      titleSv: 'Risk 1 – Motorcykel',
      titleEn: 'Risk 1 – Motorcycle',
      description: 'Teoretisk riskutbildning för motorcykelförare.',
      type: 'Risk1',
      vehicle: 'Motorcycle',
      price: 1500,
    },
  });

  const risk2Moto = await prisma.course.create({
    data: {
      titleSv: 'Risk 2 – Motorcykel',
      titleEn: 'Risk 2 – Motorcycle',
      description: 'Praktisk körning på halkbana för motorcykelförare.',
      type: 'Risk2',
      vehicle: 'Motorcycle',
      price: 2800,
    },
  });

  // Sessions (dates from mid-April 2026 onward)
  await prisma.session.createMany({
    data: [
      {
        courseId: risk1Car.id,
        schoolId: school1.id,
        startTime: new Date('2026-04-10T09:00:00'),
        endTime: new Date('2026-04-10T12:00:00'),
        seatLimit: 20,
        seatsAvailable: 8,
      },
      {
        courseId: risk2Car.id,
        schoolId: school1.id,
        startTime: new Date('2026-04-12T10:00:00'),
        endTime: new Date('2026-04-12T16:00:00'),
        seatLimit: 15,
        seatsAvailable: 3,
      },
      {
        courseId: risk1Moto.id,
        schoolId: school2.id,
        startTime: new Date('2026-04-15T13:00:00'),
        endTime: new Date('2026-04-15T17:00:00'),
        seatLimit: 12,
        seatsAvailable: 0,
      },
      {
        courseId: risk2Moto.id,
        schoolId: school1.id,
        startTime: new Date('2026-04-18T08:00:00'),
        endTime: new Date('2026-04-18T14:00:00'),
        seatLimit: 10,
        seatsAvailable: 6,
      },
      {
        courseId: risk1Car.id,
        schoolId: school2.id,
        startTime: new Date('2026-04-22T09:00:00'),
        endTime: new Date('2026-04-22T12:00:00'),
        seatLimit: 20,
        seatsAvailable: 15,
      },
      {
        courseId: risk2Car.id,
        schoolId: school2.id,
        startTime: new Date('2026-04-25T10:00:00'),
        endTime: new Date('2026-04-25T16:00:00'),
        seatLimit: 15,
        seatsAvailable: 11,
      },
    ],
  });

  // Users
  const hashedStudentPwd = await bcrypt.hash('password123', 10);
  const hashedAdminPwd = await bcrypt.hash('password123', 10);

  const student = await prisma.user.create({
    data: {
      name: 'Anna Svensson',
      email: 'student@test.se',
      password: hashedStudentPwd,
      phone: '070-123 45 67',
      role: 'student',
      languagePref: 'sv',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@test.se',
      password: hashedAdminPwd,
      phone: '070-000 00 00',
      role: 'admin',
      languagePref: 'sv',
    },
  });

  // Sample bookings for student
  const sessions = await prisma.session.findMany({ take: 2 });
  for (const session of sessions) {
    const booking = await prisma.booking.create({
      data: {
        sessionId: session.id,
        userId: student.id,
        status: 'Paid',
      },
    });
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 0, // will be set from course price in real flow
        provider: 'Stripe',
        status: 'Succeeded',
        transactionId: `txn_seed_${booking.id}`,
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
