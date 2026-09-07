/**
 * Database Seeder — Populates ReMedistribution with realistic Pakistani data
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ReMedistribution database...\n');

  // ─── Users ──────────────────────────────────────────────────────

  const salt = await bcrypt.genSalt(10);

  const donor = await prisma.user.create({
    data: {
      name: 'Ahmed Khan',
      email: 'ahmed.donor@example.com',
      password: await bcrypt.hash('password123', salt),
      role: 'DONOR',
      phone: '+92-300-1234567',
      city: 'Lahore',
      address: '45-B, Model Town, Lahore',
      lat: 31.5204,
      lng: 74.3587,
      emailVerified: true,
    },
  });

  const pharmacist = await prisma.user.create({
    data: {
      name: 'Dr. Fatima Zahra',
      email: 'fatima.pharmacist@example.com',
      password: await bcrypt.hash('password123', salt),
      role: 'PHARMACIST',
      phone: '+92-321-9876543',
      city: 'Lahore',
      address: 'Indus Hospital, Lahore',
      emailVerified: true,
    },
  });

  const patient1 = await prisma.user.create({
    data: {
      name: 'Muhammad Ali',
      email: 'ali.patient@example.com',
      password: await bcrypt.hash('password123', salt),
      role: 'PATIENT',
      phone: '+92-333-5551234',
      city: 'Lahore',
      address: '12, Anarkali Bazaar, Lahore',
      lat: 31.5580,
      lng: 74.3130,
      emailVerified: true,
    },
  });

  const patient2 = await prisma.user.create({
    data: {
      name: 'Ayesha Bibi',
      email: 'ayesha.patient@example.com',
      password: await bcrypt.hash('password123', salt),
      role: 'PATIENT',
      phone: '+92-345-7778899',
      city: 'Karachi',
      address: 'Saddar, Karachi',
      lat: 24.8607,
      lng: 67.0011,
      emailVerified: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@remedistribution.com',
      password: await bcrypt.hash('admin123', salt),
      role: 'ADMIN',
      phone: '+92-21-1234567',
      city: 'Karachi',
      emailVerified: true,
    },
  });

  console.log(`✅ Created ${5} users`);

  // ─── Collection Centers ─────────────────────────────────────────

  const centers = await Promise.all([
    prisma.collectionCenter.create({
      data: {
        name: 'Edhi Foundation — Lahore Center',
        address: '35-A, Jail Road, Gulberg III, Lahore',
        city: 'Lahore',
        phone: '+92-42-35761999',
        email: 'lahore@edhi.org',
        type: 'NGO',
        lat: 31.5204,
        lng: 74.3587,
        openTime: '08:00',
        closeTime: '20:00',
      },
    }),
    prisma.collectionCenter.create({
      data: {
        name: 'Saylani Welfare — Karachi Main Branch',
        address: 'Block 6, PECHS, Shahrah-e-Faisal, Karachi',
        city: 'Karachi',
        phone: '+92-21-111-729-526',
        email: 'info@saylaniwelfare.com',
        type: 'NGO',
        lat: 24.8607,
        lng: 67.0011,
        openTime: '09:00',
        closeTime: '21:00',
      },
    }),
    prisma.collectionCenter.create({
      data: {
        name: 'Indus Hospital — Pharmacy Desk',
        address: 'Plot 167, Sector 44, Korangi, Karachi',
        city: 'Karachi',
        phone: '+92-21-35042761',
        email: 'pharmacy@indushospital.org.pk',
        type: 'HOSPITAL',
        lat: 24.8508,
        lng: 67.1321,
        openTime: '08:00',
        closeTime: '22:00',
      },
    }),
    prisma.collectionCenter.create({
      data: {
        name: 'Shaukat Khanum — Lahore Pharmacy',
        address: '7A, Block R-3, Johar Town, Lahore',
        city: 'Lahore',
        phone: '+92-42-35905000',
        email: 'pharmacy@skm.org.pk',
        type: 'HOSPITAL',
        lat: 31.4697,
        lng: 74.2728,
        openTime: '07:00',
        closeTime: '21:00',
      },
    }),
    prisma.collectionCenter.create({
      data: {
        name: 'Servaid Pharmacy — Faisalabad',
        address: 'Jinnah Colony, Faisalabad',
        city: 'Faisalabad',
        phone: '+92-41-2645123',
        email: 'branch.fsd@servaid.com.pk',
        type: 'PHARMACY',
        lat: 31.4504,
        lng: 73.1350,
        openTime: '08:00',
        closeTime: '23:00',
      },
    }),
    prisma.collectionCenter.create({
      data: {
        name: 'PIMS Hospital — Pharmacy',
        address: 'Shaheed-e-Millat Expressway, G-8/3, Islamabad',
        city: 'Islamabad',
        phone: '+92-51-9261171',
        email: 'pharmacy@pims.gov.pk',
        type: 'HOSPITAL',
        lat: 33.7067,
        lng: 73.0479,
        openTime: '07:00',
        closeTime: '22:00',
      },
    }),
  ]);

  console.log(`✅ Created ${centers.length} collection centers`);

  // Link the Lahore pharmacist to Shaukat Khanum Memorial Hospital — Pharmacy (index 3)
  await prisma.user.update({
    where: { id: pharmacist.id },
    data: { centerId: centers[3].id },
  });

  // ─── Medicines ──────────────────────────────────────────────────

  const medicines = await Promise.all([
    prisma.medicine.create({
      data: { name: 'Glimepiride', genericName: 'Glimepiride', category: 'Diabetes', manufacturer: 'Getz Pharma', dosage: '2mg', form: 'Tablet', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Insulin Glargine (Lantus)', genericName: 'Insulin Glargine', category: 'Diabetes', manufacturer: 'Abbott Laboratories', dosage: '100IU/ml', form: 'Injection Pen', requiresColdChain: true },
    }),
    prisma.medicine.create({
      data: { name: 'Metformin (Glucophage)', genericName: 'Metformin HCl', category: 'Diabetes', manufacturer: 'The Searle Company', dosage: '500mg', form: 'Tablet', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Panadol', genericName: 'Paracetamol', category: 'Pain Relief', manufacturer: 'GSK Pakistan', dosage: '500mg', form: 'Tablet', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Augmentin', genericName: 'Amoxicillin/Clavulanate', category: 'Antibiotics', manufacturer: 'GSK Pakistan', dosage: '625mg', form: 'Tablet', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Amlodipine', genericName: 'Amlodipine Besylate', category: 'Cardiovascular', manufacturer: 'Sami Pharmaceuticals', dosage: '5mg', form: 'Tablet', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Atorvastatin (Atocor)', genericName: 'Atorvastatin', category: 'Cardiovascular', manufacturer: 'Getz Pharma', dosage: '20mg', form: 'Tablet', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Omeprazole (Risek)', genericName: 'Omeprazole', category: 'Gastrointestinal', manufacturer: 'Getz Pharma', dosage: '20mg', form: 'Capsule', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Salbutamol Inhaler (Ventolin)', genericName: 'Salbutamol', category: 'Respiratory', manufacturer: 'GSK Pakistan', dosage: '100mcg', form: 'Inhaler', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Losartan (Xartan)', genericName: 'Losartan Potassium', category: 'Cardiovascular', manufacturer: 'Sami Pharmaceuticals', dosage: '50mg', form: 'Tablet', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Dexamethasone (Decadron)', genericName: 'Dexamethasone', category: 'Steroids', manufacturer: 'Martin Dow', dosage: '4mg', form: 'Tablet', requiresColdChain: false },
    }),
    prisma.medicine.create({
      data: { name: 'Ciprofloxacin (Ciproxin)', genericName: 'Ciprofloxacin', category: 'Antibiotics', manufacturer: 'Bayer Pakistan', dosage: '500mg', form: 'Tablet', requiresColdChain: false },
    }),
  ]);

  console.log(`✅ Created ${medicines.length} medicines`);

  // ─── Sample Donations ───────────────────────────────────────────

  const futureDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  const pastDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };

  const sampleDonations = [
    { donorId: donor.id, medicineId: medicines[0].id, centerId: centers[0].id, status: 'APPROVED', quantity: 3, batchNumber: 'GLM2025A1', expiryDate: futureDate(180), sealIntact: true, storageVerified: true, aiRiskScore: 'LOW', aiConfidence: 0.92, pharmacistNotes: 'Verified — packaging intact', verifiedById: pharmacist.id },
    { donorId: donor.id, medicineId: medicines[1].id, centerId: centers[0].id, status: 'APPROVED', quantity: 2, batchNumber: 'INS2025B3', expiryDate: futureDate(120), sealIntact: true, storageVerified: true, aiRiskScore: 'LOW', aiConfidence: 0.88, pharmacistNotes: 'Cold chain maintained', verifiedById: pharmacist.id },
    { donorId: donor.id, medicineId: medicines[3].id, centerId: centers[3].id, status: 'APPROVED', quantity: 5, batchNumber: 'PAN2025X', expiryDate: futureDate(365), sealIntact: true, storageVerified: true, aiRiskScore: 'LOW', aiConfidence: 0.95, verifiedById: pharmacist.id },
    { donorId: donor.id, medicineId: medicines[5].id, centerId: centers[0].id, status: 'SCANNED', quantity: 2, batchNumber: 'AML25K7', expiryDate: futureDate(90), sealIntact: true, storageVerified: true, aiRiskScore: 'LOW', aiConfidence: 0.85 },
    { donorId: donor.id, medicineId: medicines[8].id, centerId: centers[3].id, status: 'SCANNED', quantity: 1, batchNumber: 'SAL2025C', expiryDate: futureDate(200), sealIntact: true, storageVerified: false, aiRiskScore: 'MEDIUM', aiConfidence: 0.7, aiNotes: 'Storage not verified — manual check needed' },
    { donorId: donor.id, medicineId: medicines[2].id, centerId: centers[0].id, status: 'PENDING', quantity: 4, batchNumber: '??', expiryDate: futureDate(15), sealIntact: false, storageVerified: false, aiRiskScore: 'HIGH', aiConfidence: 0.6, aiNotes: 'No batch number provided. Seal reported as broken' },
  ];

  const createdDonations = [];
  for (const d of sampleDonations) {
    const donation = await prisma.donation.create({ data: d });
    createdDonations.push(donation);
  }

  console.log(`✅ Created ${createdDonations.length} sample donations`);

  // ─── Inventory (from approved donations) ─────────────────────────

  const inventoryItems = [];
  for (const d of createdDonations.filter((don) => don.status === 'APPROVED')) {
    const item = await prisma.inventoryItem.create({
      data: {
        centerId: d.centerId,
        medicineId: d.medicineId,
        donationId: d.id,
        quantity: d.quantity,
        batchNumber: d.batchNumber,
        expiryDate: d.expiryDate,
        status: 'AVAILABLE',
      },
    });
    inventoryItems.push(item);
  }

  console.log(`✅ Created ${inventoryItems.length} inventory items`);

  // ─── Patient Requests ───────────────────────────────────────────

  const requests = await Promise.all([
    prisma.patientRequest.create({
      data: {
        patientId: patient1.id,
        medicineName: 'Glimepiride',
        medicineId: medicines[0].id,
        urgency: 'HIGH',
        location: 'Anarkali, Lahore',
        city: 'Lahore',
        lat: 31.5580,
        lng: 74.3130,
        description: 'My father is diabetic and we cannot afford his monthly Glimepiride supply. Need 2mg tablets urgently.',
        quantity: 2,
      },
    }),
    prisma.patientRequest.create({
      data: {
        patientId: patient2.id,
        medicineName: 'Insulin',
        urgency: 'CRITICAL',
        location: 'Saddar, Karachi',
        city: 'Karachi',
        lat: 24.8607,
        lng: 67.0011,
        description: 'Mujhe insulin ki zaroorat hai, meri ammi ko diabetes hai. Please help.',
        quantity: 1,
        chatInput: 'Mujhe insulin ki zaroorat hai, meri ammi ko diabetes hai. Please help.',
      },
    }),
    prisma.patientRequest.create({
      data: {
        patientId: patient1.id,
        medicineName: 'Salbutamol Inhaler',
        medicineId: medicines[8].id,
        urgency: 'MEDIUM',
        location: 'Lahore',
        city: 'Lahore',
        description: 'Need Ventolin inhaler for my asthma. Cannot buy a new one this month.',
        quantity: 1,
      },
    }),
  ]);

  console.log(`\u2705 Created ${requests.length} patient requests`);
  
  // ─── Sample Match with Fulfillment History ───────────────────
  
  const match1 = await prisma.match.create({
    data: {
      patientRequestId: requests[0].id,
      inventoryItemId: inventoryItems[0].id,
      status: 'READY_FOR_PICKUP',
      pickupCode: String(Math.floor(100000 + Math.random() * 900000)),
      pickupCodeExpiresAt: futureDate(2),
      score: 92.5,
      fulfillmentHistory: JSON.stringify([
        { status: 'MATCHED', timestamp: pastDate(2).toISOString(), actorId: pharmacist.id, notes: 'Match created by pharmacist' },
        { status: 'READY_FOR_PICKUP', timestamp: pastDate(1).toISOString(), actorId: pharmacist.id, notes: 'Pickup code generated' },
      ]),
    },
  });
  
  // A completed match
  const match2 = await prisma.match.create({
    data: {
      patientRequestId: requests[2].id,
      inventoryItemId: inventoryItems[2].id,
      status: 'COMPLETED',
      pickupCode: '000000',
      pickupCodeExpiresAt: pastDate(5),
      score: 88.0,
      matchedAt: pastDate(10),
      completedAt: pastDate(5),
      fulfillmentHistory: JSON.stringify([
        { status: 'MATCHED', timestamp: pastDate(10).toISOString(), actorId: pharmacist.id, notes: 'Match created' },
        { status: 'READY_FOR_PICKUP', timestamp: pastDate(9).toISOString(), actorId: pharmacist.id, notes: 'Ready for pickup' },
        { status: 'PICKED_UP', timestamp: pastDate(7).toISOString(), actorId: pharmacist.id, notes: 'Patient picked up medicine' },
        { status: 'COMPLETED', timestamp: pastDate(5).toISOString(), actorId: pharmacist.id, notes: 'Delivery confirmed' },
      ]),
    },
  });
  
  console.log(`\u2705 Created 2 sample matches`);
  
  // ─── Sample Notifications ──────────────────────────────────────
  
  await Promise.all([
    prisma.notification.create({
      data: {
        userId: donor.id,
        type: 'DONATION_RECEIVED',
        title: 'Donation Received',
        message: 'Your donation of Glimepiride has been received at Edhi Foundation center.',
        isRead: true,
        link: '/my-donations',
      },
    }),
    prisma.notification.create({
      data: {
        userId: donor.id,
        type: 'DONATION_APPROVED',
        title: 'Donation Approved',
        message: 'Your Glimepiride donation has been verified and approved by the pharmacist.',
        isRead: false,
        link: '/my-donations',
      },
    }),
    prisma.notification.create({
      data: {
        userId: patient1.id,
        type: 'MATCH_FOUND',
        title: 'Match Found!',
        message: 'A donor has been found for your Glimepiride request. Check your requests for pickup details.',
        isRead: false,
        link: '/my-requests',
      },
    }),
    prisma.notification.create({
      data: {
        userId: patient1.id,
        type: 'PICKUP_READY',
        title: 'Ready for Pickup',
        message: 'Your medicine is ready! Show your pickup code at the collection center.',
        isRead: false,
        link: '/my-requests',
      },
    }),
    prisma.notification.create({
      data: {
        userId: patient1.id,
        type: 'MATCH_COMPLETED',
        title: 'Delivery Confirmed',
        message: 'Your Salbutamol Inhaler request has been fulfilled. We hope you feel better!',
        isRead: true,
        link: '/my-requests',
      },
    }),
    prisma.notification.create({
      data: {
        userId: pharmacist.id,
        type: 'NEW_DONATION',
        title: 'New Donation Pending',
        message: 'A new donation of Amlodipene is pending verification.',
        isRead: false,
        link: '/dashboard',
      },
    }),
  ]);
  
  console.log(`\u2705 Created 6 sample notifications`);

  // ─── Summary ────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Database seeded successfully!');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('  Test accounts (password for all: password123):');
  console.log(`  • Donor:      ${donor.email}`);
  console.log(`  • Pharmacist: ${pharmacist.email}`);
  console.log(`  • Patient 1:  ${patient1.email}`);
  console.log(`  • Patient 2:  ${patient2.email}`);
  console.log(`  • Admin:      admin@remedistribution.com (admin123)`);
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
