/**
 * One-off helper: links existing PHARMACIST accounts to a CollectionCenter.
 * It tries to match the hospital name in the pharmacist's address to a center,
 * otherwise falls back to the first center in the same city.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pharmacists = await prisma.user.findMany({
    where: { role: 'PHARMACIST' },
    select: { id: true, name: true, address: true, city: true },
  });

  const centers = await prisma.collectionCenter.findMany();

  for (const p of pharmacists) {
    let center = null;
    const addressHospital = p.address?.split(',')[0]?.trim().toLowerCase();

    if (addressHospital) {
      center = centers.find((c) => c.name.toLowerCase().includes(addressHospital));
    }

    if (!center && p.city) {
      center = centers.find((c) => c.city.toLowerCase() === p.city.toLowerCase());
    }

    if (center) {
      await prisma.user.update({
        where: { id: p.id },
        data: { centerId: center.id },
      });
      console.log(`Linked ${p.name} -> ${center.name} (${center.city})`);
    } else {
      console.log(`Could not find a center for ${p.name}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
