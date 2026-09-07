import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Users, Package, Clock, MapPin, Phone, Search, QrCode, Shield, X,
  CheckCircle, AlertTriangle, Timer, Calendar, Truck,
} from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';

const URGENCY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const urgencyBadge = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-gray-100 text-gray-700 border-gray-200',
};

const statusBadge = {
  PENDING: { label: 'Pending', cls: 'badge-yellow' },
  MATCHED: { label: 'Match found', cls: 'badge-green' },
  FULFILLED: { label: 'Delivered', cls: 'badge-gray' },
  CANCELLED: { label: 'Cancelled', cls: 'badge-red' },
};

const matchStatusBadge = {
  ACTIVE: { label: 'Matched', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  PICKED_UP: { label: 'Picked Up', cls: 'bg-green-50 text-green-700 border-green-200' },
  COMPLETED: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200' },
};

export default function PatientRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('PENDING');

  // Find-match modal state
  const [matching, setMatching] = useState(null); // request being matched
  const [candidates, setCandidates] = useState(null); // null = loading, [] = none
  const [selected, setSelected] = useState(null); // inventoryItemId
  const [finding, setFinding] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(null); // { match, qrImage, pickupCode, expiresAt }

  const fetchRequests = useCallback(async (statusTab) => {
    try {
      const params = statusTab && statusTab !== 'ALL' ? { status: statusTab, limit: 100 } : { limit: 100 };
      const res = await api.get('/patients', { params });
      const list = res.data.data || [];
      list.sort((a, b) => {
        const rankDiff = (URGENCY_RANK[b.urgency] || 0) - (URGENCY_RANK[a.urgency] || 0);
        if (rankDiff !== 0) return rankDiff;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      setRequests(list);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests(tab);
  }, [tab, fetchRequests]);

  // Real-time: new patient requests arrive while the page is open
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => {
      toast.success('New patient request received!');
      fetchRequests(tab);
    };
    socket.on('request:new', handler);
    return () => socket.off('request:new', handler);
  }, [tab, fetchRequests]);

  // ── Find Match flow ─────────────────────────────────────────────

  const openFindMatch = async (request) => {
    setMatching(request);
    setCandidates(null);
    setSelected(null);
    setApproved(null);
    setFinding(true);
    try {
      const res = await api.get(`/matching/request/${request.id}/candidates`);
      const list = res.data.data?.candidates || [];
      setCandidates(list);
      if (list.length > 0) setSelected(list[0].inventoryItemId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to find matches');
      setCandidates([]);
    } finally {
      setFinding(false);
    }
  };

  const closeFindMatch = () => {
    setMatching(null);
    setCandidates(null);
    setSelected(null);
    setApproved(null);
    fetchRequests(tab);
  };

  const handleApprove = async () => {
    if (!matching) return;
    setApproving(true);
    try {
      const res = await api.post(`/matching/request/${matching.id}/approve`, {
        inventoryItemId: selected || undefined,
      });
      setApproved(res.data.data);
      toast.success('Match approved — pickup code generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve match');
    } finally {
      setApproving(false);
    }
  };

  const countdown = (expiresAt) => {
    if (!expiresAt) return '';
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${mins}m remaining` : `${mins}m remaining`;
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="page-container">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patient Requests</h1>
            <p className="text-gray-500">Review requests by urgency, find matching inventory, and approve pickups</p>
          </div>
        </div>
        <Link to="/pickup" className="btn-primary gap-2">
          <Shield className="w-5 h-5" /> Pickup Verification
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'PENDING', label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'MATCHED', label: 'Matched' },
          { key: 'FULFILLED', label: 'Delivered' },
          { key: 'ALL', label: 'All' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
              tab === t.key ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-20 h-20 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">No requests here</h3>
          <p className="text-gray-500 mt-2">
            {tab === 'PENDING' ? 'No pending requests — patients will appear here as soon as they submit one.' : 'Nothing to show for this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const sBadge = statusBadge[r.status] || statusBadge.PENDING;
            const activeMatches = (r.matches || []).filter((m) => m.status !== 'CANCELLED');
            const mBadge = activeMatches[0] ? matchStatusBadge[activeMatches[0].status] || matchStatusBadge.ACTIVE : null;
            return (
              <div key={r.id} className="card">
                {/* Request header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${urgencyBadge[r.urgency] || urgencyBadge.MEDIUM}`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-lg">{r.medicineName}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgencyBadge[r.urgency] || urgencyBadge.MEDIUM}`}>
                          {r.urgency}
                        </span>
                        <span className={sBadge.cls}>{sBadge.label}</span>
                        {mBadge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${mBadge.cls}`}>{mBadge.label}</span>}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {r.patient?.name}</span>
                        <span>Qty: {r.quantity}</span>
                        {(r.location || r.city) && (
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {r.location || r.city}</span>
                        )}
                        {r.patient?.phone && (
                          <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {r.patient.phone}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(r.status === 'PENDING' || r.status === 'MATCHED') && (
                      <button onClick={() => openFindMatch(r)} className="btn-primary text-sm gap-2 py-2 px-4">
                        <Search className="w-4 h-4" /> Find Match
                      </button>
                    )}
                    {r.status === 'MATCHED' && activeMatches.length > 0 && (
                      <Link to="/pickup" className="btn-secondary text-sm gap-2 py-2 px-4">
                        <QrCode className="w-4 h-4" /> Verify Pickup
                      </Link>
                    )}
                  </div>
                </div>

                {/* Description */}
                {r.description && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mt-3">"{r.description}"</p>
                )}

                {/* Match info for matched requests */}
                {activeMatches.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {activeMatches.map((m) => (
                      <div key={m.id} className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4" /> Matched with {m.inventoryItem?.medicine?.name}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {m.inventoryItem?.center?.name}
                              {m.inventoryItem?.center?.city ? `, ${m.inventoryItem.center.city}` : ''}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Matched {new Date(m.matchedAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-mono font-bold text-emerald-700 tracking-widest">{m.pickupCode}</p>
                            {m.status === 'READY_FOR_PICKUP' && m.pickupCodeExpiresAt && (
                              <p className="text-xs text-yellow-700 flex items-center gap-1 justify-end mt-1">
                                <Timer className="w-3 h-3" /> {countdown(m.pickupCodeExpiresAt)}
                              </p>
                            )}
                            {m.status === 'PICKED_UP' && (
                              <p className="text-xs text-green-700 flex items-center gap-1 justify-end mt-1">
                                <Truck className="w-3 h-3" /> Awaiting delivery confirmation
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Requested {new Date(r.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Find Match / Approve modal ─────────────────────────────── */}
      {matching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Find Match</h3>
                <p className="text-sm text-gray-500">
                  {matching.medicineName} · Qty {matching.quantity} · {matching.urgency} urgency
                  {matching.city || matching.location ? ` · ${matching.location || matching.city}` : ''}
                </p>
              </div>
              <button onClick={closeFindMatch} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* Approved state — show pickup code + QR */}
              {approved ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">Match approved — inventory reserved!</h4>
                  <p className="text-sm text-gray-500">
                    The patient has been notified. Their medicine will be held at{' '}
                    <span className="font-semibold text-gray-700">{approved.match.inventoryItem?.center?.name}</span>.
                  </p>
                  <div className="bg-gray-50 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-6">
                    <img src={approved.qrImage} alt="Pickup QR code" className="w-36 h-36 rounded-lg bg-white p-1 border" />
                    <div className="text-center sm:text-left">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 justify-center sm:justify-start">
                        <QrCode className="w-4 h-4" /> 6-Digit Pickup Code
                      </p>
                      <p className="text-4xl font-mono font-bold text-emerald-700 tracking-[0.2em] my-2">{approved.pickupCode}</p>
                      <p className="text-xs text-yellow-700 flex items-center gap-1 justify-center sm:justify-start">
                        <Timer className="w-3 h-3" /> Valid for 48 hours — {countdown(approved.expiresAt)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Patient shows this QR code (or shares the code) at pickup. Verify it on the Pickup Verification page.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={closeFindMatch} className="btn-secondary flex-1">Done</button>
                    <Link to="/pickup" className="btn-primary flex-1 gap-2 justify-center">
                      <Shield className="w-4 h-4" /> Open Pickup Verification
                    </Link>
                  </div>
                </div>
              ) : finding ? (
                <div className="flex flex-col items-center py-12 gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
                  <p className="text-gray-500">Searching available inventory…</p>
                </div>
              ) : candidates && candidates.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="font-semibold text-gray-800">No matching inventory found</h4>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    No available inventory matches "{matching.medicineName}" right now. The request stays pending —
                    try again once new donations are verified.
                  </p>
                  <button onClick={closeFindMatch} className="btn-secondary">Close</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    Best available matches, ranked by distance, expiry (FEFO), urgency, and stock:
                  </p>
                  {(candidates || []).map((c) => {
                    const isSelected = selected === c.inventoryItemId;
                    return (
                      <button
                        key={c.inventoryItemId}
                        onClick={() => setSelected(c.inventoryItemId)}
                        className={`w-full text-left border-2 rounded-xl p-4 transition ${
                          isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                              isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
                            }`}>
                              {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{c.medicine?.name}</p>
                              <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" /> {c.center?.name}, {c.center?.city}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3">
                                <span>Qty: {c.quantity}</span>
                                {c.batchNumber && <span>Batch: {c.batchNumber}</span>}
                                {c.expiryDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Exp: {new Date(c.expiryDate).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                                {c.distanceKm !== null && <span>~{c.distanceKm} km away</span>}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                              c.score >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : c.score >= 40 ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              Score {Math.round(c.score)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  <button
                    onClick={handleApprove}
                    disabled={!selected || approving}
                    className="btn-primary w-full gap-2 disabled:opacity-50"
                  >
                    {approving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Approving…
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" /> Approve &amp; Generate Pickup Code
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    This reserves the inventory item, marks the request as matched, and sends the patient a
                    6-digit code + QR valid for 48 hours.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
