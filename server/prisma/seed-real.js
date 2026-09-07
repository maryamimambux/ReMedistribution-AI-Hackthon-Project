/**
 * seed-real.js — Real-world data seed for ReMedistribution
 *
 * 6 cities x 5 real collection centers (hospitals / pharmacies / NGOs) = 30 centers
 * 48 real Pakistani-market medicines, 20 stocked per center = 600 inventory items
 * Real users (per-city pharmacists, patients, donors), demo donations, requests, matches.
 *
 * Run:  npm run seed:real   (from /server)
 * ⚠️  Wipes and replaces ALL existing data.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ─── Deterministic pseudo-random helpers (reproducible seed) ─────────
let _seed = 20260907;
function rand() {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// ─── Medicine catalog — real medicines sold in Pakistan ──────────────
const MEDICINES = [
  // Pain Relief
  { name: 'Panadol', genericName: 'Paracetamol', category: 'Pain Relief', manufacturer: 'GSK Pakistan', dosage: '500mg', form: 'Tablet' },
  { name: 'Panadol Extra', genericName: 'Paracetamol + Caffeine', category: 'Pain Relief', manufacturer: 'GSK Pakistan', dosage: '500mg/65mg', form: 'Tablet' },
  { name: 'Brufen', genericName: 'Ibuprofen', category: 'Pain Relief', manufacturer: 'Abbott Laboratories', dosage: '400mg', form: 'Tablet' },
  { name: 'Nuberol Forte', genericName: 'Paracetamol + Orphenadrine', category: 'Pain Relief', manufacturer: 'GSK Pakistan', dosage: '650mg/50mg', form: 'Tablet' },
  { name: 'Disprin', genericName: 'Aspirin', category: 'Pain Relief', manufacturer: 'Reckitt', dosage: '300mg', form: 'Tablet' },
  { name: 'Voltral', genericName: 'Diclofenac Sodium', category: 'Pain Relief', manufacturer: 'Novartis Pakistan', dosage: '50mg', form: 'Tablet' },
  // Antibiotics
  { name: 'Augmentin', genericName: 'Amoxicillin + Clavulanate', category: 'Antibiotics', manufacturer: 'GSK Pakistan', dosage: '625mg', form: 'Tablet' },
  { name: 'Amoxil', genericName: 'Amoxicillin Trihydrate', category: 'Antibiotics', manufacturer: 'GSK Pakistan', dosage: '500mg', form: 'Capsule' },
  { name: 'Ciproxin', genericName: 'Ciprofloxacin', category: 'Antibiotics', manufacturer: 'Bayer Pakistan', dosage: '500mg', form: 'Tablet' },
  { name: 'Cefspan', genericName: 'Cefixime', category: 'Antibiotics', manufacturer: 'Barrett Hodgson', dosage: '400mg', form: 'Capsule' },
  { name: 'Zithromax', genericName: 'Azithromycin', category: 'Antibiotics', manufacturer: 'Pfizer Pakistan', dosage: '500mg', form: 'Tablet' },
  { name: 'Flagyl', genericName: 'Metronidazole', category: 'Antibiotics', manufacturer: 'Sanofi-Aventis', dosage: '400mg', form: 'Tablet' },
  { name: 'Septran', genericName: 'Co-trimoxazole', category: 'Antibiotics', manufacturer: 'GSK Pakistan', dosage: '480mg', form: 'Tablet' },
  { name: 'Levoflox', genericName: 'Levofloxacin', category: 'Antibiotics', manufacturer: 'Getz Pharma', dosage: '500mg', form: 'Tablet' },
  // Diabetes
  { name: 'Glucophage', genericName: 'Metformin HCl', category: 'Diabetes', manufacturer: 'Merck', dosage: '500mg', form: 'Tablet' },
  { name: 'Amaryl', genericName: 'Glimepiride', category: 'Diabetes', manufacturer: 'Sanofi-Aventis', dosage: '2mg', form: 'Tablet' },
  { name: 'Lantus SoloStar', genericName: 'Insulin Glargine', category: 'Diabetes', manufacturer: 'Sanofi-Aventis', dosage: '100IU/ml', form: 'Injection Pen', requiresColdChain: true },
  { name: 'Humulin 70/30', genericName: 'Insulin Human', category: 'Diabetes', manufacturer: 'Eli Lilly', dosage: '100IU/ml', form: 'Vial', requiresColdChain: true },
  { name: 'Januvia', genericName: 'Sitagliptin', category: 'Diabetes', manufacturer: 'MSD', dosage: '50mg', form: 'Tablet' },
  // Cardiovascular
  { name: 'Atocor', genericName: 'Atorvastatin', category: 'Cardiovascular', manufacturer: 'Getz Pharma', dosage: '20mg', form: 'Tablet' },
  { name: 'Lipitor', genericName: 'Atorvastatin', category: 'Cardiovascular', manufacturer: 'Pfizer Pakistan', dosage: '10mg', form: 'Tablet' },
  { name: 'Norvasc', genericName: 'Amlodipine Besylate', category: 'Cardiovascular', manufacturer: 'Pfizer Pakistan', dosage: '5mg', form: 'Tablet' },
  { name: 'Concor', genericName: 'Bisoprolol Fumarate', category: 'Cardiovascular', manufacturer: 'Merck', dosage: '5mg', form: 'Tablet' },
  { name: 'Tenormin', genericName: 'Atenolol', category: 'Cardiovascular', manufacturer: 'AstraZeneca', dosage: '50mg', form: 'Tablet' },
  { name: 'Xartan', genericName: 'Losartan Potassium', category: 'Cardiovascular', manufacturer: 'Sami Pharmaceuticals', dosage: '50mg', form: 'Tablet' },
  { name: 'Plavix', genericName: 'Clopidogrel Bisulfate', category: 'Cardiovascular', manufacturer: 'Sanofi-Aventis', dosage: '75mg', form: 'Tablet' },
  { name: 'Ascard', genericName: 'Aspirin (Low Dose)', category: 'Cardiovascular', manufacturer: 'Atco Laboratories', dosage: '75mg', form: 'Tablet' },
  { name: 'Lasix', genericName: 'Furosemide', category: 'Cardiovascular', manufacturer: 'Sanofi-Aventis', dosage: '40mg', form: 'Tablet' },
  { name: 'Lanoxin', genericName: 'Digoxin', category: 'Cardiovascular', manufacturer: 'GSK Pakistan', dosage: '0.25mg', form: 'Tablet' },
  // Gastrointestinal
  { name: 'Risek', genericName: 'Omeprazole', category: 'Gastrointestinal', manufacturer: 'Getz Pharma', dosage: '20mg', form: 'Capsule' },
  { name: 'Nexum', genericName: 'Esomeprazole', category: 'Gastrointestinal', manufacturer: 'Getz Pharma', dosage: '40mg', form: 'Capsule' },
  { name: 'Motilium', genericName: 'Domperidone', category: 'Gastrointestinal', manufacturer: 'Janssen', dosage: '10mg', form: 'Tablet' },
  { name: 'Buscopan', genericName: 'Hyoscine Butylbromide', category: 'Gastrointestinal', manufacturer: 'Searle', dosage: '10mg', form: 'Tablet' },
  { name: 'Imodium', genericName: 'Loperamide', category: 'Gastrointestinal', manufacturer: 'Janssen', dosage: '2mg', form: 'Capsule' },
  // Antiemetic
  { name: 'Gravinate', genericName: 'Dimenhydrinate', category: 'Antiemetic', manufacturer: 'Hilton', dosage: '50mg', form: 'Tablet' },
  // Respiratory
  { name: 'Ventolin Inhaler', genericName: 'Salbutamol', category: 'Respiratory', manufacturer: 'GSK Pakistan', dosage: '100mcg', form: 'Inhaler' },
  { name: 'Symbicort Turbuhaler', genericName: 'Budesonide + Formoterol', category: 'Respiratory', manufacturer: 'AstraZeneca', dosage: '160/4.5mcg', form: 'Inhaler' },
  // Allergy
  { name: 'Rigix', genericName: 'Cetirizine', category: 'Allergy', manufacturer: 'Getz Pharma', dosage: '10mg', form: 'Tablet' },
  { name: 'Softin', genericName: 'Loratadine', category: 'Allergy', manufacturer: 'Hilton', dosage: '10mg', form: 'Tablet' },
  { name: 'Piriton', genericName: 'Chlorpheniramine Maleate', category: 'Allergy', manufacturer: 'GSK Pakistan', dosage: '4mg', form: 'Tablet' },
  // Steroids
  { name: 'Decadron', genericName: 'Dexamethasone', category: 'Steroids', manufacturer: 'Martin Dow', dosage: '0.5mg', form: 'Tablet' },
  { name: 'Prednisolone', genericName: 'Prednisolone', category: 'Steroids', manufacturer: 'Ferozsons', dosage: '5mg', form: 'Tablet' },
  // Endocrine
  { name: 'Thyronorm', genericName: 'Levothyroxine Sodium', category: 'Endocrine', manufacturer: 'Abbott Laboratories', dosage: '50mcg', form: 'Tablet' },
  { name: 'Eltroxin', genericName: 'Levothyroxine Sodium', category: 'Endocrine', manufacturer: 'GSK Pakistan', dosage: '100mcg', form: 'Tablet' },
  // Supplements
  { name: 'Fefol', genericName: 'Ferrous Sulphate + Folic Acid', category: 'Supplements', manufacturer: 'GSK Pakistan', dosage: '150mg/0.5mg', form: 'Capsule' },
  { name: 'Cal-D', genericName: 'Calcium + Vitamin D3', category: 'Supplements', manufacturer: 'Highnoon', dosage: '600mg/200IU', form: 'Tablet' },
  { name: 'Indrop D', genericName: 'Cholecalciferol (Vitamin D3)', category: 'Supplements', manufacturer: 'Hilton', dosage: '200,000 IU', form: 'Oral Drops' },
  { name: 'Peditral', genericName: 'ORS (Oral Rehydration Salts)', category: 'Rehydration', manufacturer: 'Abbott Laboratories', dosage: 'Sachet', form: 'Powder' },
  // Antifungal
  { name: 'Flucos', genericName: 'Fluconazole', category: 'Antifungal', manufacturer: 'Ferozsons', dosage: '150mg', form: 'Tablet' },
];

// Every center stocks these 10 essentials + 10 rotating medicines = 20
const ESSENTIAL_NAMES = [
  'Panadol', 'Brufen', 'Augmentin', 'Amoxil', 'Glucophage',
  'Lantus SoloStar', 'Ventolin Inhaler', 'Risek', 'Atocor', 'Norvasc',
];

// ─── Real collection centers — 5 per city, 6 cities ─────────────────
const CENTERS = [
  // Karachi
  { name: 'Aga Khan University Hospital — Pharmacy', type: 'HOSPITAL', city: 'Karachi', address: 'Stadium Road, Karimabad, Karachi', phone: '+92 21 111 911 911', lat: 24.8627, lng: 67.0401, openTime: '07:00', closeTime: '23:00' },
  { name: 'Indus Hospital — Pharmacy Desk', type: 'HOSPITAL', city: 'Karachi', address: 'Plot C-76, Sector 32/6, Korangi Crossing, Karachi', phone: '+92 21 3511 2805', lat: 24.8508, lng: 67.1321, openTime: '08:00', closeTime: '22:00' },
  { name: 'Saylani Welfare Trust — Medical Store', type: 'NGO', city: 'Karachi', address: 'Block 6, PECHS, Shahrah-e-Faisal, Karachi', phone: '+92 21 111 729 526', lat: 24.8615, lng: 67.0555, openTime: '09:00', closeTime: '21:00' },
  { name: 'Edhi Foundation — Karachi Medical Center', type: 'NGO', city: 'Karachi', address: 'Scout Madressa Road, Near Numaish Chowrangi, Karachi', phone: '+92 21 3221 2444', lat: 24.8826, lng: 67.0347, openTime: '08:00', closeTime: '20:00' },
  { name: 'Servaid Pharmacy — DHA Phase 6', type: 'PHARMACY', city: 'Karachi', address: 'Shop 14, Khayaban-e-Shahbaz Commercial, DHA Phase 6, Karachi', phone: '+92 21 3529 4200', lat: 24.8139, lng: 67.0362, openTime: '08:00', closeTime: '23:30' },
  // Lahore
  { name: 'Shaukat Khanum Memorial Hospital — Pharmacy', type: 'HOSPITAL', city: 'Lahore', address: '7-A Block R-3, Johar Town, Lahore', phone: '+92 42 3594 5100', lat: 31.4697, lng: 74.2728, openTime: '07:00', closeTime: '23:00' },
  { name: 'Fatima Memorial Hospital — Pharmacy', type: 'HOSPITAL', city: 'Lahore', address: 'Shadman Colony, Jail Road, Lahore', phone: '+92 42 111 555 550', lat: 31.5448, lng: 74.3288, openTime: '08:00', closeTime: '22:00' },
  { name: 'Al-Khidmat Foundation — Lahore', type: 'NGO', city: 'Lahore', address: 'Ravi Road, Opposite Bust Stop, Lahore', phone: '+92 42 3723 8257', lat: 31.5850, lng: 74.3105, openTime: '09:00', closeTime: '20:00' },
  { name: 'Edhi Foundation — Lahore Center', type: 'NGO', city: 'Lahore', address: 'Edhi Center, Block 3, Gulshan-e-Ravi, Lahore', phone: '+92 42 3746 0311', lat: 31.5540, lng: 74.2955, openTime: '08:00', closeTime: '20:00' },
  { name: 'Servaid Pharmacy — Gulberg III', type: 'PHARMACY', city: 'Lahore', address: '112-A Main Boulevard, Gulberg III, Lahore', phone: '+92 42 3577 5540', lat: 31.5184, lng: 74.3411, openTime: '08:00', closeTime: '23:00' },
  // Islamabad
  { name: 'Shifa International Hospital — Pharmacy', type: 'HOSPITAL', city: 'Islamabad', address: 'Sector H-8/4, Pitras Bukhari Road, Islamabad', phone: '+92 51 846 4613', lat: 33.6893, lng: 73.0653, openTime: '07:00', closeTime: '23:00' },
  { name: 'PIMS — Pakistan Institute of Medical Sciences Pharmacy', type: 'HOSPITAL', city: 'Islamabad', address: 'Sector G-8/3, Islamabad', phone: '+92 51 926 1170', lat: 33.7067, lng: 73.0479, openTime: '08:00', closeTime: '22:00' },
  { name: 'Al-Khidmat Foundation — Islamabad', type: 'NGO', city: 'Islamabad', address: 'Jinnah Avenue, Blue Area, Islamabad', phone: '+92 51 2870 054', lat: 33.7115, lng: 73.0570, openTime: '09:00', closeTime: '20:00' },
  { name: 'D. Watson Pharmacy — F-7 Markaz', type: 'PHARMACY', city: 'Islamabad', address: 'Shop 10, Jinnah Super Market, F-7 Markaz, Islamabad', phone: '+92 51 2611 744', lat: 33.7185, lng: 73.0545, openTime: '08:00', closeTime: '23:00' },
  { name: 'CDA Capital Hospital — Pharmacy', type: 'HOSPITAL', city: 'Islamabad', address: 'Sector G-6/2, Islamabad', phone: '+92 51 925 2200', lat: 33.7120, lng: 73.0662, openTime: '08:00', closeTime: '21:00' },
  // Rawalpindi
  { name: 'Holy Family Hospital — Pharmacy', type: 'HOSPITAL', city: 'Rawalpindi', address: 'Satellite Town, Rawalpindi', phone: '+92 51 929 0403', lat: 33.6198, lng: 73.0679, openTime: '07:00', closeTime: '23:00' },
  { name: 'Combined Military Hospital (CMH) — Pharmacy', type: 'HOSPITAL', city: 'Rawalpindi', address: 'The Mall, Rawalpindi Cantt', phone: '+92 51 5612 2211', lat: 33.5888, lng: 73.0499, openTime: '08:00', closeTime: '22:00' },
  { name: 'Benazir Bhutto Hospital — Pharmacy', type: 'HOSPITAL', city: 'Rawalpindi', address: 'Murree Road, Rawalpindi', phone: '+92 51 928 8106', lat: 33.5869, lng: 73.0563, openTime: '08:00', closeTime: '22:00' },
  { name: 'Al-Khidmat Foundation — Rawalpindi', type: 'NGO', city: 'Rawalpindi', address: 'Bank Road, Saddar, Rawalpindi', phone: '+92 51 5564 005', lat: 33.5989, lng: 73.0498, openTime: '09:00', closeTime: '20:00' },
  { name: 'Servaid Pharmacy — Saddar', type: 'PHARMACY', city: 'Rawalpindi', address: 'Shop 5, Bank Road, Saddar, Rawalpindi', phone: '+92 51 5573 772', lat: 33.5962, lng: 73.0514, openTime: '08:00', closeTime: '23:00' },
  // Faisalabad
  { name: 'Allied Hospital — Pharmacy', type: 'HOSPITAL', city: 'Faisalabad', address: 'Sargodha Road, Faisalabad', phone: '+92 41 9201 0011', lat: 31.4298, lng: 73.0764, openTime: '07:00', closeTime: '23:00' },
  { name: 'DHQ Hospital — Pharmacy', type: 'HOSPITAL', city: 'Faisalabad', address: 'Civil Lines, Jail Road, Faisalabad', phone: '+92 41 9206 0301', lat: 31.4247, lng: 73.0800, openTime: '08:00', closeTime: '22:00' },
  { name: 'Mujahid Hospital — Pharmacy', type: 'HOSPITAL', city: 'Faisalabad', address: 'Susan Road, Madina Town, Faisalabad', phone: '+92 41 8712 662', lat: 31.4198, lng: 73.0880, openTime: '08:00', closeTime: '22:00' },
  { name: 'Al-Khidmat Foundation — Faisalabad', type: 'NGO', city: 'Faisalabad', address: 'Peoples Colony No. 1, Faisalabad', phone: '+92 41 8722 260', lat: 31.4187, lng: 73.0840, openTime: '09:00', closeTime: '20:00' },
  { name: 'Servaid Pharmacy — Jinnah Colony', type: 'PHARMACY', city: 'Faisalabad', address: 'Main Bazaar, Jinnah Colony, Faisalabad', phone: '+92 41 8715 333', lat: 31.4350, lng: 73.0690, openTime: '08:00', closeTime: '23:00' },
  // Peshawar
  { name: 'Lady Reading Hospital — Pharmacy', type: 'HOSPITAL', city: 'Peshawar', address: 'Soekarno Square, Peshawar', phone: '+92 91 9211 430', lat: 34.0059, lng: 71.5580, openTime: '07:00', closeTime: '23:00' },
  { name: 'Khyber Teaching Hospital — Pharmacy', type: 'HOSPITAL', city: 'Peshawar', address: 'University Road, Peshawar', phone: '+92 91 9216 601', lat: 34.0053, lng: 71.6720, openTime: '08:00', closeTime: '22:00' },
  { name: 'Hayatabad Medical Complex — Pharmacy', type: 'HOSPITAL', city: 'Peshawar', address: 'Phase 4, Hayatabad, Peshawar', phone: '+92 91 9211 860', lat: 33.9960, lng: 71.4700, openTime: '08:00', closeTime: '22:00' },
  { name: 'Rehman Medical Institute — Pharmacy', type: 'HOSPITAL', city: 'Peshawar', address: 'Phase 5, Hayatabad, Peshawar', phone: '+92 91 8313 600', lat: 33.9900, lng: 71.4600, openTime: '08:00', closeTime: '21:00' },
  { name: 'Al-Khidmat Foundation — Peshawar', type: 'NGO', city: 'Peshawar', address: 'Soekarno Square, Peshawar', phone: '+92 91 5842 061', lat: 34.0060, lng: 71.5600, openTime: '09:00', closeTime: '20:00' },
];

// ─── Users ───────────────────────────────────────────────────────────
const USERS = [
  { name: 'System Administrator', email: 'admin@remedistribution.com', password: 'admin123', role: 'ADMIN', phone: '+92 300 1234567', city: 'Karachi', address: 'Clifton Block 2, Karachi', lat: 24.7949, lng: 67.0285 },
  // Pharmacists — one per city (they receive new-request notifications for their city)
  { name: 'Dr. Fatima Zahra', email: 'fatima.pharmacist@example.com', password: 'password123', role: 'PHARMACIST', phone: '+92 321 4578012', city: 'Lahore', address: 'Shaukat Khanum Memorial Hospital, Johar Town, Lahore', lat: 31.4697, lng: 74.2728, centerName: 'Shaukat Khanum Memorial Hospital — Pharmacy' },
  { name: 'Dr. Omar Farooq', email: 'omar.pharmacist@example.com', password: 'password123', role: 'PHARMACIST', phone: '+92 333 2214678', city: 'Karachi', address: 'Aga Khan University Hospital, Stadium Road, Karachi', lat: 24.8627, lng: 67.0401, centerName: 'Aga Khan University Hospital — Pharmacy' },
  { name: 'Dr. Sana Malik', email: 'sana.pharmacist@example.com', password: 'password123', role: 'PHARMACIST', phone: '+92 345 9901122', city: 'Islamabad', address: 'Shifa International Hospital, H-8/4, Islamabad', lat: 33.6893, lng: 73.0653, centerName: 'Shifa International Hospital — Pharmacy' },
  { name: 'Dr. Bilal Ahmed', email: 'bilal.pharmacist@example.com', password: 'password123', role: 'PHARMACIST', phone: '+92 312 7765544', city: 'Rawalpindi', address: 'Holy Family Hospital, Satellite Town, Rawalpindi', lat: 33.6198, lng: 73.0679, centerName: 'Holy Family Hospital — Pharmacy' },
  { name: 'Dr. Hira Shah', email: 'hira.pharmacist@example.com', password: 'password123', role: 'PHARMACIST', phone: '+92 301 5543322', city: 'Faisalabad', address: 'Allied Hospital, Sargodha Road, Faisalabad', lat: 31.4298, lng: 73.0764, centerName: 'Allied Hospital — Pharmacy' },
  { name: 'Dr. Kashif Khan', email: 'kashif.pharmacist@example.com', password: 'password123', role: 'PHARMACIST', phone: '+92 349 8890011', city: 'Peshawar', address: 'Lady Reading Hospital, Peshawar', lat: 34.0059, lng: 71.5580, centerName: 'Lady Reading Hospital — Pharmacy' },
  // Patients
  { name: 'Muhammad Ali', email: 'ali.patient@example.com', password: 'password123', role: 'PATIENT', phone: '+92 302 4455667', city: 'Lahore', address: 'House 42, Anarkali Bazaar, Lahore', lat: 31.5580, lng: 74.3130 },
  { name: 'Ayesha Bibi', email: 'ayesha.patient@example.com', password: 'password123', role: 'PATIENT', phone: '+92 333 9087761', city: 'Karachi', address: 'Flat 3-B, Empress Market, Saddar, Karachi', lat: 24.8607, lng: 67.0011 },
  { name: 'Usman Ghani', email: 'usman.patient@example.com', password: 'password123', role: 'PATIENT', phone: '+92 335 1120034', city: 'Islamabad', address: 'Street 12, G-11/3, Islamabad', lat: 33.6883, lng: 72.9867 },
  // Donors
  { name: 'Ahmed Khan', email: 'ahmed.donor@example.com', password: 'password123', role: 'DONOR', phone: '+92 316 3345578', city: 'Lahore', address: 'House 15, Model Town, Lahore', lat: 31.4812, lng: 74.3238 },
  { name: 'Sara Ahmed', email: 'sara.donor@example.com', password: 'password123', role: 'DONOR', phone: '+92 322 6659900', city: 'Karachi', address: 'B-201, North Nazimabad Block H, Karachi', lat: 24.9425, lng: 67.0402 },
];

async function main() {
  console.log('🌱 Seeding REAL-WORLD data…');

  // ─── 1. Wipe existing data (FK-safe order) ────────────────────────
  await prisma.match.deleteMany({});
  await prisma.verification.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.query.deleteMany({});
  await prisma.patientRequest.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.donation.deleteMany({});
  await prisma.demandForecast.deleteMany({});
  await prisma.medicine.deleteMany({});
  await prisma.collectionCenter.deleteMany({});
  await prisma.user.deleteMany({});

  // ─── 2. Collection centers ───────────────────────────────────────
  const centers = {};
  for (const c of CENTERS) {
    centers[c.name] = await prisma.collectionCenter.create({ data: c });
  }
  console.log(`✓ ${CENTERS.length} centers created (${[...new Set(CENTERS.map(c => c.city))].length} cities)`);

  // ─── 3. Users ─────────────────────────────────────────────────────
  const salt = await bcrypt.genSalt(10);
  const users = {};
  for (const u of USERS) {
    users[u.email] = await prisma.user.create({
      data: {
        name: u.name, email: u.email, password: await bcrypt.hash(u.password, salt),
        role: u.role, phone: u.phone, city: u.city, address: u.address,
        centerId: u.centerName ? centers[u.centerName]?.id : undefined,
        lat: u.lat, lng: u.lng, emailVerified: true, isActive: true,
      },
    });
  }
  console.log(`✓ ${USERS.length} users created`);

  // ─── 4. Medicines ─────────────────────────────────────────────────
  const medicines = {};
  for (const m of MEDICINES) {
    medicines[m.name] = await prisma.medicine.create({ data: m });
  }
  console.log(`✓ ${MEDICINES.length} medicines created`);

  // ─── 5. Inventory — 20 medicines per center (10 essentials + 10 rotating) ──
  const essentials = ESSENTIAL_NAMES.map((n) => medicines[n]);
  const rotating = MEDICINES.filter((m) => !ESSENTIAL_NAMES.includes(m.name)).map((m) => medicines[m.name]);
  const centerList = Object.values(centers);
  const inventoryByKey = {}; // `${center.name}::${medicine.name}` -> item
  const abbr = (name) => name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();

  for (let ci = 0; ci < centerList.length; ci++) {
    const center = centerList[ci];
    const rotation = Array.from({ length: 10 }, (_, k) => rotating[(ci * 7 + k) % rotating.length]);
    const stock = [...essentials, ...rotation];
    for (const med of stock) {
      const batchNumber = `${abbr(med.name)}-${String(randInt(24, 26))}${String(randInt(1, 12)).padStart(2, '0')}-${randInt(100, 999)}`;
      const item = await prisma.inventoryItem.create({
        data: {
          centerId: center.id,
          medicineId: med.id,
          quantity: randInt(5, 60),
          status: 'AVAILABLE',
          batchNumber,
          expiryDate: daysFromNow(randInt(90, 700)),
          receivedAt: daysAgo(randInt(1, 60)),
        },
      });
      inventoryByKey[`${center.name}::${med.name}`] = item;
    }
  }
  console.log(`✓ ${centerList.length * 20} inventory items created (20 per center)`);

  // ─── 6. Demo donations (verification queue + a few approved) ──────
  const ahmed = users['ahmed.donor@example.com'];
  const sara = users['sara.donor@example.com'];
  const fatima = users['fatima.pharmacist@example.com'];
  const omar = users['omar.pharmacist@example.com'];

  const donationSpecs = [
    { donor: ahmed, med: 'Concor', center: 'Edhi Foundation — Lahore Center', status: 'PENDING', qty: 8, ai: { risk: 'LOW', conf: 0.92, notes: 'Seal intact, batch and expiry clearly readable.' } },
    { donor: ahmed, med: 'Zithromax', center: 'Shaukat Khanum Memorial Hospital — Pharmacy', status: 'SCANNED', qty: 5, ai: { risk: 'LOW', conf: 0.88, notes: 'Label clear. Packaging in good condition.' } },
    { donor: ahmed, med: 'Ciproxin', center: 'Servaid Pharmacy — Gulberg III', status: 'PENDING', qty: 12, ai: null },
    { donor: sara, med: 'Flucos', center: 'Saylani Welfare Trust — Medical Store', status: 'PENDING', qty: 6, ai: { risk: 'MEDIUM', conf: 0.74, notes: 'Expiry date partially obscured — physical check advised.' } },
    { donor: sara, med: 'Imodium', center: 'Aga Khan University Hospital — Pharmacy', status: 'SCANNED', qty: 10, ai: { risk: 'LOW', conf: 0.95, notes: 'All checks passed.' } },
    { donor: sara, med: 'Thyronorm', center: 'Indus Hospital — Pharmacy Desk', status: 'PENDING', qty: 4, ai: null },
  ];
  for (const d of donationSpecs) {
    await prisma.donation.create({
      data: {
        donorId: d.donor.id,
        medicineId: medicines[d.med].id,
        centerId: centers[d.center].id,
        status: d.status,
        quantity: d.qty,
        batchNumber: `${abbr(d.med)}-${String(randInt(24, 26))}${String(randInt(1, 12)).padStart(2, '0')}-${randInt(100, 999)}`,
        expiryDate: daysFromNow(randInt(120, 500)),
        sealIntact: true,
        storageVerified: true,
        aiRiskScore: d.ai?.risk ?? null,
        aiConfidence: d.ai?.conf ?? null,
        aiNotes: d.ai?.notes ?? null,
        createdAt: daysAgo(randInt(1, 5)),
      },
    });
  }
  console.log(`✓ ${donationSpecs.length} donations created (for verification queue)`);

  // ─── 7. Demo patient requests ────────────────────────────────────
  const ali = users['ali.patient@example.com'];
  const ayesha = users['ayesha.patient@example.com'];
  const usman = users['usman.patient@example.com'];

  // 7a. Pending requests (visible in pharmacist Patient Requests list)
  const pendingSpecs = [
    { patient: ali, medicine: 'Glucophage', qty: 2, urgency: 'HIGH', location: 'Anarkali, Lahore', desc: 'My father is a diabetic and we cannot afford his monthly supply of metformin. He has been prescribed it for over a year.' },
    { patient: ali, medicine: 'Cal-D', qty: 1, urgency: 'LOW', location: 'Model Town, Lahore', desc: 'Doctor recommended a calcium supplement after my recent surgery. Any help would be appreciated.' },
    { patient: ayesha, medicine: 'Humulin 70/30', qty: 1, urgency: 'CRITICAL', location: 'Saddar, Karachi', desc: 'My son ran out of insulin two days ago. His sugar is spiking. We urgently need this medicine — we cannot afford a new vial this month.' },
    { patient: usman, medicine: 'Symbicort Turbuhaler', qty: 1, urgency: 'MEDIUM', location: 'G-11, Islamabad', desc: 'I have chronic asthma and my preventer inhaler is almost finished. Need a replacement soon.' },
  ];
  for (const p of pendingSpecs) {
    await prisma.patientRequest.create({
      data: {
        patientId: p.patient.id,
        medicineName: p.medicine,
        medicineId: medicines[p.medicine]?.id ?? null,
        urgency: p.urgency,
        location: p.location,
        city: p.patient.city,
        description: p.desc,
        quantity: p.qty,
        status: 'PENDING',
        createdAt: daysAgo(randInt(0, 2)),
      },
    });
  }
  console.log(`✓ ${pendingSpecs.length} pending requests created`);

  // 7b. Matched request — READY_FOR_PICKUP with live pickup code + QR
  const lantusAkuh = inventoryByKey['Aga Khan University Hospital — Pharmacy::Lantus SoloStar'];
  await prisma.inventoryItem.update({ where: { id: lantusAkuh.id }, data: { status: 'RESERVED' } });
  const matchedRequest = await prisma.patientRequest.create({
    data: {
      patientId: ayesha.id,
      medicineName: 'Lantus SoloStar',
      medicineId: medicines['Lantus SoloStar'].id,
      urgency: 'CRITICAL',
      location: 'Saddar, Karachi',
      city: 'Karachi',
      description: 'Insulin glargine needed for my mother — long-acting insulin for her daily dose.',
      quantity: 1,
      status: 'MATCHED',
      createdAt: daysAgo(1),
    },
  });
  const history = (steps) => JSON.stringify(steps);
  await prisma.match.create({
    data: {
      inventoryItemId: lantusAkuh.id,
      patientRequestId: matchedRequest.id,
      score: 87.5,
      status: 'READY_FOR_PICKUP',
      pickupCode: String(randInt(100000, 999999)),
      pickupCodeExpiresAt: daysFromNow(2),
      matchedAt: daysAgo(1),
      fulfillmentHistory: history([
        { status: 'MATCHED', timestamp: daysAgo(1).toISOString(), actorId: omar.id, notes: 'Matched with Aga Khan University Hospital — Pharmacy (score 87.5).' },
        { status: 'READY_FOR_PICKUP', timestamp: daysAgo(1).toISOString(), actorId: omar.id, notes: 'Pickup code generated. Valid for 48 hours.' },
      ]),
    },
  });
  await prisma.notification.create({
    data: {
      userId: ayesha.id,
      type: 'MATCH_FOUND',
      title: 'Match Found — Lantus SoloStar',
      message: 'Your insulin request has been matched. Show the QR code or 6-digit pickup code at Aga Khan University Hospital — Pharmacy. Code valid for 48 hours.',
      link: '/my-requests',
    },
  });
  console.log('✓ 1 matched request (READY_FOR_PICKUP) with pickup code created');

  // 7c. Completed request — full fulfillment timeline
  const ventolinShifa = inventoryByKey['Shifa International Hospital — Pharmacy::Ventolin Inhaler'];
  await prisma.inventoryItem.update({ where: { id: ventolinShifa.id }, data: { status: 'DISPATCHED' } });
  const doneRequest = await prisma.patientRequest.create({
    data: {
      patientId: usman.id,
      medicineName: 'Ventolin Inhaler',
      medicineId: medicines['Ventolin Inhaler'].id,
      urgency: 'MEDIUM',
      location: 'G-11, Islamabad',
      city: 'Islamabad',
      description: 'Asthma attack relief — salbutamol inhaler urgently needed.',
      quantity: 1,
      status: 'FULFILLED',
      createdAt: daysAgo(4),
    },
  });
  await prisma.match.create({
    data: {
      inventoryItemId: ventolinShifa.id,
      patientRequestId: doneRequest.id,
      score: 91.2,
      status: 'COMPLETED',
      pickupCode: String(randInt(100000, 999999)),
      pickupCodeExpiresAt: daysAgo(1),
      matchedAt: daysAgo(4),
      completedAt: daysAgo(2),
      fulfillmentHistory: history([
        { status: 'MATCHED', timestamp: daysAgo(4).toISOString(), actorId: fatima.id, notes: 'Matched with Shifa International Hospital — Pharmacy (score 91.2).' },
        { status: 'READY_FOR_PICKUP', timestamp: daysAgo(4).toISOString(), actorId: fatima.id, notes: 'Pickup code generated.' },
        { status: 'PICKED_UP', timestamp: daysAgo(3).toISOString(), actorId: fatima.id, notes: 'Pickup code verified at center. Inventory dispatched.' },
        { status: 'COMPLETED', timestamp: daysAgo(2).toISOString(), actorId: fatima.id, notes: 'Medicine delivered to patient. Request fulfilled.' },
      ]),
    },
  });
  await prisma.notification.create({
    data: {
      userId: usman.id,
      type: 'PICKUP_READY',
      title: 'Medicine Delivered — Ventolin Inhaler',
      message: 'Your request has been completed. The inhaler was collected from Shifa International Hospital — Pharmacy.',
      link: '/my-requests',
      isRead: true,
    },
  });
  console.log('✓ 1 completed request with full timeline created');

  // ─── 8. Sample notifications for demo users ────────────────────────
  await prisma.notification.create({
    data: {
      userId: fatima.id,
      type: 'NEW_REQUEST',
      title: 'New Medicine Request',
      message: 'Muhammad Ali requested Glucophage (x2) in Lahore — urgency: HIGH.',
      link: '/patient-requests',
    },
  });
  await prisma.notification.create({
    data: {
      userId: omar.id,
      type: 'NEW_REQUEST',
      title: 'Critical Request Nearby',
      message: 'Ayesha Bibi requested Humulin 70/30 (x1) in Karachi — urgency: CRITICAL.',
      link: '/patient-requests',
    },
  });
  await prisma.notification.create({
    data: {
      userId: ahmed.id,
      type: 'DONATION_RECEIVED',
      title: 'Donation Received',
      message: 'Your Concor donation (x8) was dropped at Edhi Foundation — Lahore Center and is awaiting verification.',
      link: '/donor-dashboard',
    },
  });
  console.log('✓ Sample notifications created');

  // ─── Summary ──────────────────────────────────────────────────────
  const summary = await prisma.$transaction(async (tx) => ({
    users: await tx.user.count(),
    centers: await tx.collectionCenter.count(),
    medicines: await tx.medicine.count(),
    inventory: await tx.inventoryItem.count(),
    donations: await tx.donation.count(),
    requests: await tx.patientRequest.count(),
    matches: await tx.match.count(),
  }));
  console.log('\n══════════════════ SEED COMPLETE ══════════════════');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nLogin accounts (password shown in parentheses):');
  USERS.forEach((u) => console.log(`  [${u.role.padEnd(9)}] ${u.email} (${u.password})`));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
