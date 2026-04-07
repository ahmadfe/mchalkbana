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
  await prisma.settings.deleteMany();

  // Settings
  await prisma.settings.create({
    data: {
      key: 'receipt_message',
      value: 'Ta med körkort och giltig ID-handling. Parkering finns framför byggnaden. Vid frågor, kontakta oss på info@uppsalahalkbana.se.',
    },
  });

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
      behorighet: 'B',
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
      behorighet: 'B',
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
      behorighet: 'A',
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
      behorighet: 'A',
      price: 2800,
    },
  });

  // Sessions (public + school-only mix)
  await prisma.session.createMany({
    data: [
      {
        courseId: risk1Car.id,
        schoolId: school1.id,
        startTime: new Date('2026-04-10T09:00:00'),
        endTime: new Date('2026-04-10T12:00:00'),
        seatLimit: 20,
        seatsAvailable: 8,
        visibility: 'public',
      },
      {
        courseId: risk2Car.id,
        schoolId: school1.id,
        startTime: new Date('2026-04-12T10:00:00'),
        endTime: new Date('2026-04-12T16:00:00'),
        seatLimit: 15,
        seatsAvailable: 3,
        visibility: 'public',
      },
      {
        courseId: risk1Moto.id,
        schoolId: school2.id,
        startTime: new Date('2026-04-15T13:00:00'),
        endTime: new Date('2026-04-15T17:00:00'),
        seatLimit: 12,
        seatsAvailable: 0,
        visibility: 'public',
      },
      {
        courseId: risk2Moto.id,
        schoolId: school1.id,
        startTime: new Date('2026-04-18T08:00:00'),
        endTime: new Date('2026-04-18T14:00:00'),
        seatLimit: 10,
        seatsAvailable: 6,
        visibility: 'public',
      },
      {
        courseId: risk1Car.id,
        schoolId: school2.id,
        startTime: new Date('2026-04-22T09:00:00'),
        endTime: new Date('2026-04-22T12:00:00'),
        seatLimit: 20,
        seatsAvailable: 15,
        visibility: 'school',
      },
      {
        courseId: risk2Car.id,
        schoolId: school2.id,
        startTime: new Date('2026-04-25T10:00:00'),
        endTime: new Date('2026-04-25T16:00:00'),
        seatLimit: 15,
        seatsAvailable: 11,
        visibility: 'public',
      },
    ],
  });

  // Users
  const hashedPwd = await bcrypt.hash('password123', 10);

  await prisma.user.create({
    data: {
      name: 'Anna Svensson',
      email: 'student@test.se',
      password: hashedPwd,
      phone: '070-123 45 67',
      role: 'student',
      languagePref: 'sv',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@test.se',
      password: hashedPwd,
      phone: '070-000 00 00',
      role: 'admin',
      languagePref: 'sv',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Uppsala Trafikskola AB',
      email: 'school@test.se',
      password: hashedPwd,
      phone: '018-100 200',
      role: 'school',
      languagePref: 'sv',
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
