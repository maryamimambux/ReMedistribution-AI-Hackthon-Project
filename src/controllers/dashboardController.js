/**
 * Dashboard Controller — Aggregated stats and overview
 */

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * GET /api/dashboard
 * Role-based dashboard stats
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const role = req.user.role;
  const isPharmacist = role === 'PHARMACIST';
  const pharmacistCenterId = isPharmacist ? req.user.centerId : null;
  const pharmacistCity = isPharmacist ? (req.user.center?.city || req.user.city) : null;

  // Scope everything to the pharmacist's linked center (or city as a fallback)
  const donationWhere = pharmacistCenterId ? { centerId: pharmacistCenterId } : {};
  const requestWhere = pharmacistCity
    ? { city: { equals: pharmacistCity, mode: 'insensitive' } }
    : {};
  const inventoryWhere = { status: 'AVAILABLE', ...(pharmacistCenterId ? { centerId: pharmacistCenterId } : {}) };
  const matchWhere = pharmacistCenterId
    ? { inventoryItem: { centerId: pharmacistCenterId } }
    : pharmacistCity
    ? { patientRequest: { city: { equals: pharmacistCity, mode: 'insensitive' } } }
    : {};
  const centerWhere = { isActive: true, ...(pharmacistCity ? { city: { equals: pharmacistCity, mode: 'insensitive' } } : {}) };

  const [
    totalDonations,
    approvedDonations,
    pendingDonations,
    totalInventory,
    totalPatientRequests,
    fulfilledRequests,
    pendingRequests,
    totalMatches,
    totalCenters,
    totalUsers,
  ] = await Promise.all([
    prisma.donation.count({ where: donationWhere }),
    prisma.donation.count({ where: { ...donationWhere, status: 'APPROVED' } }),
    prisma.donation.count({ where: { ...donationWhere, status: { in: ['PENDING', 'SCANNED'] } } }),
    prisma.inventoryItem.count({ where: inventoryWhere }),
    prisma.patientRequest.count({ where: requestWhere }),
    prisma.patientRequest.count({ where: { ...requestWhere, status: 'FULFILLED' } }),
    prisma.patientRequest.count({ where: { ...requestWhere, status: 'PENDING' } }),
    prisma.match.count({ where: matchWhere }),
    prisma.collectionCenter.count({ where: centerWhere }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  // Category breakdown (system-wide for admin, scoped by center inventory for pharmacist)
  const categoryBreakdown = pharmacistCenterId
    ? await prisma.inventoryItem
        .findMany({
          where: { centerId: pharmacistCenterId, status: 'AVAILABLE' },
          include: { medicine: { select: { category: true } } },
        })
        .then((items) => {
          const counts = {};
          items.forEach((i) => {
            counts[i.medicine.category] = (counts[i.medicine.category] || 0) + 1;
          });
          return Object.entries(counts)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count);
        })
    : await prisma.medicine.groupBy({
        by: ['category'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }).then((rows) => rows.map((r) => ({ category: r.category, count: r._count.id })));

  // City breakdown
  const cityBreakdown = await prisma.collectionCenter.groupBy({
    by: ['city'],
    where: centerWhere,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // Recent donations
  const recentDonations = await prisma.donation.findMany({
    where: donationWhere,
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      medicine: { select: { name: true, category: true } },
      donor: { select: { name: true } },
    },
  });

  // Recent patient requests
  const recentRequests = await prisma.patientRequest.findMany({
    where: requestWhere,
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      patient: { select: { name: true } },
    },
  });

  res.json({
    success: true,
    data: {
      stats: {
        totalDonations,
        approvedDonations,
        pendingDonations,
        totalInventory,
        totalPatientRequests,
        fulfilledRequests,
        pendingRequests,
        totalMatches,
        totalCenters,
        totalUsers,
        fulfillmentRate: totalPatientRequests > 0
          ? Math.round((fulfilledRequests / totalPatientRequests) * 100)
          : 0,
      },
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        count: c.count ?? c._count?.id ?? 0,
      })),
      cityBreakdown: cityBreakdown.map((c) => ({
        city: c.city,
        centers: c._count.id,
      })),
      recentDonations,
      recentRequests,
      userRole: role,
    },
  });
});

/**
 * GET /api/dashboard/overview
 * System-wide overview for admin
 */
const getSystemOverview = asyncHandler(async (req, res) => {
  // Donation trend (last 30 days, grouped by day)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentDonations = await prisma.donation.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date
  const donationTrend = {};
  recentDonations.forEach((d) => {
    const date = d.createdAt.toISOString().split('T')[0];
    if (!donationTrend[date]) donationTrend[date] = { date, total: 0, approved: 0, rejected: 0 };
    donationTrend[date].total++;
    if (d.status === 'APPROVED') donationTrend[date].approved++;
    if (d.status === 'REJECTED') donationTrend[date].rejected++;
  });

  // Expiry risk summary
  const allInventory = await prisma.inventoryItem.findMany({
    where: { status: 'AVAILABLE', expiryDate: { not: null } },
    include: { medicine: { select: { name: true, category: true } } },
  });

  const now = new Date();
  const expiringIn7 = allInventory.filter((i) => {
    const days = Math.ceil((new Date(i.expiryDate) - now) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 7;
  });

  const expiringIn30 = allInventory.filter((i) => {
    const days = Math.ceil((new Date(i.expiryDate) - now) / (1000 * 60 * 60 * 24));
    return days > 7 && days <= 30;
  });

  // Demand by medicine category
  const demandByCategory = await prisma.patientRequest.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  res.json({
    success: true,
    data: {
      donationTrend: Object.values(donationTrend),
      expiryRisk: {
        critical: expiringIn7.length,
        warning: expiringIn30.length,
        total: allInventory.length,
      },
      demandSummary: demandByCategory,
    },
  });
});

/**
 * GET /api/dashboard/export
 * Full dataset for CSV/PDF export (admin only)
 */
const getExportData = asyncHandler(async (req, res) => {
  const [donations, inventory, requests] = await Promise.all([
    prisma.donation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        medicine: { select: { name: true, category: true, dosage: true } },
        donor: { select: { name: true, email: true } },
        center: { select: { name: true, city: true } },
      },
    }),
    prisma.inventoryItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        medicine: { select: { name: true, category: true, dosage: true } },
        center: { select: { name: true, city: true } },
      },
    }),
    prisma.patientRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { name: true, email: true } },
      },
    }),
  ]);

  res.json({ success: true, data: { donations, inventory, requests } });
});

module.exports = { getDashboardStats, getSystemOverview, getExportData };
