/**
 * verify-seed.js — sanity checks for the real-world seed
 */
const prisma = require('./src/config/prisma');

(async () => {
  const byCenter = await prisma.inventoryItem.groupBy({
    by: ['centerId'],
    _count: { _all: true },
  });
  const counts = byCenter.map((c) => c._count._all);
  const bad = byCenter.filter((c) => c._count._all !== 20);

  const centers = await prisma.collectionCenter.findMany({
    include: { _count: { select: { inventoryItems: true } } },
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
  });

  console.log('Centers:', centers.length, '| inventory rows:', byCenter.length);
  console.log('Min/Max medicines per center:', Math.min(...counts), '/', Math.max(...counts));
  console.log('Centers without exactly 20:', bad.length);

  let lastCity = '';
  for (const c of centers) {
    if (c.city !== lastCity) { console.log(`\n── ${c.city} ──`); lastCity = c.city; }
    console.log(`  ${c.name.padEnd(52)} [${c.type.padEnd(8)}] ${c._count.inventoryItems} medicines  (${c.lat}, ${c.lng})`);
  }

  const sample = await prisma.inventoryItem.findMany({
    where: { center: { name: { contains: 'Shaukat Khanum' } } },
    include: { medicine: true },
    orderBy: { medicine: { name: 'asc' } },
  });
  console.log(`\nSample — Shaukat Khanum Memorial Hospital (Lahore) stock:`);
  sample.forEach((i) =>
    console.log(`  ${i.medicine.name} ${i.medicine.dosage} [${i.medicine.category}] x${i.quantity} batch ${i.batchNumber} exp ${i.expiryDate.toISOString().slice(0, 10)} [${i.status}]`)
  );

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
