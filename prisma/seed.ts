import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting database...');

  // Delete in dependency order (children before parents)
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.schoolCoursePrice.deleteMany();
  // Clear the implicit many-to-many join table for assignedSchoolUsers before deleting sessions/users
  await prisma.$executeRawUnsafe(`DELETE FROM "_AssignedSchoolSessions"`);
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.course.deleteMany();
  await prisma.school.deleteMany();
  await prisma.courseGroup.deleteMany();
  await prisma.infoCard.deleteMany();
  await prisma.settings.deleteMany();

  console.log('Creating default school venue...');
  await prisma.school.create({
    data: {
      name: 'Uppsala Halkbana',
      address: 'Norrlövsta 147, 747 91 Alunda',
      contactEmail: 'info@uppsalahalkbana.se',
    },
  });

  console.log('Creating hidden admin account...');
  const hashed = await bcrypt.hash('AboALn00r', 10);
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'ahmadfe@icloud.com',
      password: hashed,
      role: 'admin',
      hidden: true,
    },
  });

  console.log('Done. Database reset and admin account created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
