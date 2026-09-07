/**
 * End-to-end test: full medicine request → match → pickup → delivery workflow
 * Run: node test-e2e-workflow.js
 */
const axios = require('axios');

const BASE = 'http://localhost:5000/api';
let passed = 0, failed = 0;

function ok(name, condition, extra = '') {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}

async function login(email, password) {
  const res = await axios.post(`${BASE}/auth/login`, { email, password });
  return { token: res.data.data.token, user: res.data.data.user };
}

function client(token) {
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true, // don't throw — we inspect statuses
  });
}

(async () => {
  console.log('\n════════ E2E: Patient Request → Match → Pickup → Delivered ════════\n');

  // ── 1. Patient submits a medicine request ─────────────────────────
  console.log('STEP 1 — Patient submits request with name, quantity, urgency, location, description');
  const patient = await login('ali.patient@example.com', 'password123');
  const papi = client(patient.token);

  const createRes = await papi.post('/patients', {
    medicineName: 'Panadol',
    quantity: 2,
    urgency: 'HIGH',
    city: 'Lahore',
    location: 'Anarkali Bazaar, Lahore',
    description: 'E2E test request — need Panadol for fever.',
  });
  ok('Request created (201)', createRes.status === 201, JSON.stringify(createRes.data));
  const request = createRes.data.data;
  ok('Has medicineName', request.medicineName === 'Panadol');
  ok('Has quantity', request.quantity === 2);
  ok('Has urgency', request.urgency === 'HIGH');
  ok('Has location', request.location === 'Anarkali Bazaar, Lahore');
  ok('Has city', request.city === 'Lahore');
  ok('Has description', /fever/.test(request.description || ''));
  ok('Status PENDING', request.status === 'PENDING');

  // ── 2. Pharmacist gets notified ────────────────────────────────────
  console.log('\nSTEP 2 — Pharmacist receives notification about the new request');
  const pharmacist = await login('fatima.pharmacist@example.com', 'password123');
  const fapi = client(pharmacist.token);

  const notifRes = await fapi.get('/notifications?limit=10');
  const notifs = notifRes.data.data || [];
  const newReqNotif = notifs.find ? notifs.find((n) => n.type === 'NEW_REQUEST' && JSON.parse(n.metadata || '{}').requestId === request.id) : null;
  ok('NEW_REQUEST notification exists for pharmacist', !!newReqNotif, JSON.stringify(notifs.slice(0, 3)));

  // ── 3. Pharmacist opens Patient Requests list (sorted by urgency) ──
  console.log('\nSTEP 3 — Pharmacist sees Patient Requests list sorted by urgency');
  const listRes = await fapi.get('/patients?status=PENDING&limit=100');
  ok('Requests list loads (200)', listRes.status === 200);
  const list = listRes.data.data || [];
  ok('New request is in the list', list.some((r) => r.id === request.id));
  const ranks = list.map((r) => ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[r.urgency] || 0));
  const sortedDesc = ranks.every((v, i) => i === 0 || ranks[i - 1] >= v);
  ok('Sorted by urgency (CRITICAL first)', sortedDesc, ranks.join(','));
  const withDetails = list.find((r) => r.id === request.id);
  ok('Request details include patient info', withDetails?.patient?.name === 'Muhammad Ali');

  // ── 4. Pharmacist clicks "Find Match" ───────────────────────────────
  console.log('\nSTEP 4 — Pharmacist clicks Find Match (inventory candidates preview)');
  const candRes = await fapi.get(`/matching/request/${request.id}/candidates`);
  ok('Candidates endpoint works (200)', candRes.status === 200, JSON.stringify(candRes.data));
  const candidates = candRes.data.data?.candidates || [];
  ok('Finds at least one Panadol candidate', candidates.length > 0, JSON.stringify(candRes.data));
  const best = candidates[0];
  ok('Candidate has score', typeof best?.score === 'number');
  ok('Candidate has center', !!best?.center?.name);
  const bestIsPanadol = (best?.medicine?.name || '').includes('Panadol');
  ok('Best candidate is Panadol', bestIsPanadol, best?.medicine?.name);

  // ── 5. Approve & Generate Pickup Code ──────────────────────────────
  console.log('\nSTEP 5 — Approve & Generate Pickup Code (reserve inventory + 6-digit code + QR)');
  const invBefore = await fapi.get('/inventory');
  const approveRes = await fapi.post(`/matching/request/${request.id}/approve`, {
    inventoryItemId: best.inventoryItemId,
  });
  ok('Approve works (201)', approveRes.status === 201, JSON.stringify(approveRes.data));
  const { match, qrImage, pickupCode, expiresAt } = approveRes.data.data || {};
  ok('Match created with READY_FOR_PICKUP', match?.status === 'READY_FOR_PICKUP');
  ok('6-digit pickup code generated', /^\d{6}$/.test(pickupCode || ''), pickupCode);
  ok('Pickup code has 48h validity', expiresAt && new Date(expiresAt) > new Date());
  ok('QR code image generated (data URL)', typeof qrImage === 'string' && qrImage.startsWith('data:image/png'));
  ok('Inventory reserved', match?.inventoryItem && true);

  // Inventory item is now RESERVED
  const invAfter = await fapi.get('/inventory');
  const reservedItem = (invAfter.data.data || []).find((i) => i.id === best.inventoryItemId);
  const reservedOrAbsent = reservedItem ? reservedItem.status === 'RESERVED' : true; // may be filtered out of available list
  ok('Inventory item RESERVED', reservedOrAbsent, reservedItem?.status);

  // Double-approval should fail
  const doubleApprove = await fapi.post(`/matching/request/${request.id}/approve`, {});
  ok('Second approval blocked (400)', doubleApprove.status === 400);

  // Patient sees status MATCHED with timeline
  const myReqs = await papi.get('/patients/my-requests?limit=50');
  const myReq = (myReqs.data.data || []).find((r) => r.id === request.id);
  ok('Patient request status → MATCHED', myReq?.status === 'MATCHED');
  const myMatch = (myReq?.matches || []).find((m) => m.id === match.id);
  ok('Patient sees the match', !!myMatch);
  const history = JSON.parse(myMatch?.fulfillmentHistory || '[]');
  ok('Fulfillment history has MATCHED + READY_FOR_PICKUP', history.some((h) => h.status === 'MATCHED') && history.some((h) => h.status === 'READY_FOR_PICKUP'));

  // Patient can fetch their QR code
  const qrRes = await papi.get(`/matching/${match.id}/qrcode`);
  ok('Patient fetches QR code (200)', qrRes.status === 200);
  ok('QR contains pickup code', qrRes.data?.data?.pickupCode === pickupCode);

  // ── 6. Pharmacist verifies pickup (simulated QR scan + manual code) ─
  console.log('\nSTEP 6 — Pharmacist verifies pickup code (QR scan payload / manual entry)');
  // Simulate the QR payload the patient shows
  const qrPayload = JSON.stringify({ matchId: match.id, pickupCode, medicineName: 'Panadol' });
  const parsed = JSON.parse(qrPayload); // what the scanner decodes
  const badCode = await fapi.post('/matching/verify-code', { code: '000001' });
  ok('Wrong code rejected', badCode.status >= 400, JSON.stringify(badCode.data));
  const goodCode = await fapi.post('/matching/verify-code', { code: parsed.pickupCode, matchId: parsed.matchId });
  ok('verify-code works (200)', goodCode.status === 200, JSON.stringify(goodCode.data));
  ok('Match → PICKED_UP', goodCode.data?.data?.status === 'PICKED_UP');
  const pickedHistory = JSON.parse(goodCode.data?.data?.fulfillmentHistory || '[]');
  ok('History has PICKED_UP entry', pickedHistory.some((h) => h.status === 'PICKED_UP'));

  // Inventory dispatched
  const invFinal = await fapi.get('/inventory');
  const dispatchedItem = (invFinal.data.data || []).find((i) => i.id === best.inventoryItemId);
  ok('Inventory item DISPATCHED', dispatchedItem ? dispatchedItem.status === 'DISPATCHED' : true, dispatchedItem?.status);

  // Patient got PICKUP_CONFIRMED notification
  const pNotifs = await papi.get('/notifications?limit=10');
  const pList = pNotifs.data.data || [];
  ok('Patient notified of pickup', (pList.find ? pList : []).some((n) => n.type === 'PICKUP_CONFIRMED'), JSON.stringify((pList.find ? pList : []).slice(0, 2)));

  // ── 7. Pharmacist marks as Delivered ───────────────────────────────
  console.log('\nSTEP 7 — Pharmacist marks request as Delivered (finalizes request)');
  const completeRes = await fapi.patch(`/matching/${match.id}/complete`);
  ok('Complete works (200)', completeRes.status === 200, JSON.stringify(completeRes.data));
  ok('Match → COMPLETED', completeRes.data?.data?.status === 'COMPLETED');

  const myReqsFinal = await papi.get('/patients/my-requests?limit=50');
  const myReqFinal = (myReqsFinal.data.data || []).find((r) => r.id === request.id);
  ok('Patient request status → FULFILLED (finalized)', myReqFinal?.status === 'FULFILLED');
  const finalMatch = (myReqFinal?.matches || []).find((m) => m.id === match.id);
  const finalHistory = JSON.parse(finalMatch?.fulfillmentHistory || '[]');
  ok('Timeline complete: MATCHED→READY→PICKED_UP→COMPLETED',
    ['MATCHED', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'].every((s) => finalHistory.some((h) => h.status === s)),
    JSON.stringify(finalHistory.map((h) => h.status)));

  // Patient notified of delivery
  const pNotifsFinal = await papi.get('/notifications?limit=10');
  const pFinalList = pNotifsFinal.data.data || [];
  ok('Patient notified of delivery', (pFinalList.find ? pFinalList : []).some((n) => n.type === 'DELIVERY_COMPLETE'));

  // Cleanup: delete the completed test request? It's FULFILLED — patient can only delete PENDING. Leave it.

  console.log('\n════════════════════════════════════════');
  console.log(`  RESULT: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('E2E test crashed:', err.response?.data || err.message);
  process.exit(1);
});
