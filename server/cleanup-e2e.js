/**
 * Cleanup — remove E2E test artifacts and restore consumed Panadol inventory
 */
const prisma = require('./src/config/prisma');

(async () => {
  // Remove requests created by the E2E test run
  const testRequests = await prisma.patientRequest.findMany({
    where: { description: { contains: 'E2E test request' } },
  });
  for (const r of testRequests) {
    await prisma.match.deleteMany({ where: { patientRequestId: r.id } });
    await prisma.patientRequest.delete({ where: { id: r.id } });
    console.log('removed test request:', r.id.slice(0, 8));
  }

  // Restore the Panadol inventory consumed by the test
  const restored = await prisma.inventoryItem.updateMany({
    where: { status: 'DISPATCHED', medicine: { name: { contains: 'Panadol' } } },
    data: { status: 'AVAILABLE' },
  });
  console.log('restored Panadol inventory items:', restored.count);

  await prisma.$disconnect();
})();
