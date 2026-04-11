import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.school.findFirst();
  if (existing) {
    console.log('School already exists:', existing.id, existing.name);
  } else {
    const s = await prisma.school.create({
      data: {
        name: 'Uppsala Halkbana',
        address: 'Norrlövsta 147, 747 91 Alunda',
        contactEmail: 'info@uppsalahalkbana.se',
      },
    });
    console.log('Created school:', s.id, s.name);
  }
}

main().finally(() => prisma.$disconnect());
