import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Package, CheckCircle, Clock, Truck, QrCode, MapPin, Phone, Timer, Pencil, Trash2, X, Save,
} from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';
import PatientTabs from '../../components/PatientTabs';

export default function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrCodes, setQrCodes] = useState({}); // matchId -> qrImage

  // Edit modal state
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/patients/my-requests?limit=50');
      setRequests(res.data.data);

      // Fetch QR codes for READY_FOR_PICKUP matches
      for (const req of res.data.data) {
        for (const m of req.matches || []) {
          if (m.status === 'READY_FOR_PICKUP') {
            fetchQR(m.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time updates — refresh whenever the fulfillment status changes
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const events = ['match:found', 'match:ready', 'match:picked_up', 'match:completed'];
    const toasts = {
      'match:found': 'Match found for your request!',
      'match:ready': 'Your medicine is ready for pickup!',
      'match:picked_up': 'Pickup confirmed — your medicine was collected.',
      'match:completed': 'Your request has been delivered!',
    };
    const handlers = events.map((event) => {
      const handler = () => {
        toast.success(toasts[event]);
        fetchRequests();
      };
      socket.on(event, handler);
      return { event, handler };
    });

    return () => handlers.forEach(({ event, handler }) => socket.off(event, handler));
  }, [fetchRequests]);

  const fetchQR = async (matchId) => {
    try {
      const res = await api.get(`/matching/${matchId}/qrcode`);
      setQrCodes((prev) => ({ ...prev, [matchId]: res.data.data }));
    } catch (err) {
      // silent
    }
  };

  const statusConfig = {
    PENDING: { icon: Clock, color: 'badge-yellow', label: 'Searching for match', step: 1 },
    MATCHED: { icon: CheckCircle, color: 'badge-green', label: 'Match found', step: 2 },
    FULFILLED: { icon: Package, color: 'badge-gray', label: 'Delivered', step: 4 },
    CANCELLED: { icon: Clock, color: 'badge-red', label: 'Cancelled', step: 0 },
  };

  const matchStatusConfig = {
    ACTIVE: { label: 'Matched', color: 'text-blue-600', bg: 'bg-blue-50' },
    READY_FOR_PICKUP: { label: 'Ready for Pickup', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    PICKED_UP: { label: 'Picked Up', color: 'text-green-600', bg: 'bg-green-50' },
    COMPLETED: { label: 'Delivered', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50' },
  };

  const getMatchStep = (status) => {
    switch (status) {
      case 'ACTIVE': return 1;
      case 'READY_FOR_PICKUP': return 2;
      case 'PICKED_UP': return 3;
      case 'COMPLETED': return 4;
      default: return 0;
    }
  };

  const countdown = (expiresAt) => {
    if (!expiresAt) return '';
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  // Parse fulfillment history
  const parseHistory = (historyStr) => {
    try {
      return historyStr ? JSON.parse(historyStr) : [];
    } catch {
      return [];
    }
  };

  const canEditRequest = (r) => r.status === 'PENDING';

  const openEdit = (r) => {
    setEditing(r);
    setEditForm({
      medicineName: r.medicineName || '',
      urgency: r.urgency || 'MEDIUM',
      city: r.city || '',
      description: r.description || '',
      quantity: r.quantity || 1,
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editForm.medicineName) {
      toast.error('Medicine name is required');
      return;
    }
    setEditLoading(true);
    try {
      await api.patch(`/patients/${editing.id}`, editForm);
      toast.success('Request updated');
      closeEdit();
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update request');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      await api.delete(`/patients/${id}`);
      toast.success('Request deleted');
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete request');
    }
  };

  return (
    <div className="page-container">
      <PatientTabs />

      <h1 className="section-title">My Medicine Requests</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-16">
          <Package className="w-20 h-20 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">No requests yet</h3>
          <p className="text-gray-500 mt-2">Submit a request to find available medicine near you.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map((r) => {
            const config = statusConfig[r.status] || statusConfig.PENDING;
            const Icon = config.icon;
            return (
              <div key={r.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <Icon className={`w-6 h-6 mt-0.5 ${r.status === 'MATCHED' ? 'text-green-500' : r.status === 'PENDING' ? 'text-yellow-500' : 'text-gray-400'}`} />
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{r.medicineName}</h3>
                      <p className="text-sm text-gray-500">Qty: {r.quantity} · {r.city || r.location || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={config.color}>{config.label}</span>
                    <span className={`text-xs font-medium ${
                      r.urgency === 'CRITICAL' ? 'text-red-600' : r.urgency === 'HIGH' ? 'text-yellow-600' : 'text-gray-500'
                    }`}>{r.urgency}</span>
                    {canEditRequest(r) && (
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Edit request"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {r.description && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">"{r.description}"</p>
                )}

                {r.chatInput && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p className="text-xs text-blue-600 font-semibold">Chat input:</p>
                    <p className="text-sm text-blue-900">"{r.chatInput}"</p>
                  </div>
                )}

                {r.matches?.length > 0 && (
                  <div className="mt-4 space-y-4">
                    {r.matches.map((m) => {
                      const mConfig = matchStatusConfig[m.status] || matchStatusConfig.ACTIVE;
                      const history = parseHistory(m.fulfillmentHistory);
                      const currentStep = getMatchStep(m.status);
                      const qr = qrCodes[m.id];

                      return (
                        <div key={m.id} className={`border rounded-xl p-4 ${mConfig.bg}`}>
                          {/* Match header */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className={`font-semibold ${mConfig.color}`}>{mConfig.label}</p>
                              <p className="text-sm font-medium text-gray-900">{m.inventoryItem?.medicine?.name}</p>
                              <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" /> {m.inventoryItem?.center?.name}, {m.inventoryItem?.center?.address}, {m.inventoryItem?.center?.city}
                              </p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${mConfig.bg} ${mConfig.color} border`}>
                              Score: {m.score?.toFixed(0)}
                            </span>
                          </div>

                          {/* Fulfillment Timeline */}
                          <div className="mb-3">
                            <div className="flex items-center gap-1">
                              {['Matched', 'Ready for Pickup', 'Picked Up', 'Delivered'].map((label, i) => (
                                <div key={label} className="flex items-center flex-1">
                                  <div className={`flex items-center gap-1 flex-1 ${i < currentStep ? 'opacity-100' : 'opacity-40'}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                      i < currentStep ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                                    }`}>
                                      {i < currentStep ? '✓' : i + 1}
                                    </div>
                                    <span className="text-[10px] font-medium hidden sm:inline">{label}</span>
                                  </div>
                                  {i < 3 && (
                                    <div className={`h-0.5 flex-1 ${i < currentStep - 1 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                                  )}
                                </div>
                              ))}
                            </div>
                            {/* Timestamps */}
                            {history.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {history.map((h, i) => (
                                  <span key={i} className="text-[10px] text-gray-500">
                                    {h.status.replace(/_/g, ' ')}: {new Date(h.timestamp).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* QR Code for READY_FOR_PICKUP */}
                          {m.status === 'READY_FOR_PICKUP' && qr && (
                            <div className="bg-white rounded-xl p-4 border border-yellow-200 mt-3">
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0">
                                  <img src={qr.qrImage} alt="Pickup QR" className="w-32 h-32 rounded-lg" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <QrCode className="w-4 h-4 text-yellow-700" />
                                    <span className="text-sm font-bold text-yellow-800">Pickup Code</span>
                                  </div>
                                  <p className="text-3xl font-mono font-bold text-emerald-700 tracking-widest mb-2">
                                    {qr.pickupCode}
                                  </p>
                                  <div className="flex items-center gap-1 text-xs text-yellow-700">
                                    <Timer className="w-3 h-3" />
                                    <span>{countdown(qr.expiresAt)}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-2">
                                    Show this code at {m.inventoryItem?.center?.name} to collect your medicine.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Contact info for PICKED_UP / COMPLETED */}
                          {['PICKED_UP', 'COMPLETED'].includes(m.status) && (
                            <div className="bg-white rounded-lg p-3 mt-2 border border-green-200">
                              <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                  {m.status === 'PICKED_UP' ? 'Medicine collected successfully' : 'Delivery confirmed'}
                                </span>
                              </div>
                              {m.inventoryItem?.center?.phone && (
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> Contact: {m.inventoryItem.center.phone}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-3">
                  Requested {new Date(r.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Request Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Edit Request</h3>
              <button onClick={closeEdit} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-5">
              <div>
                <label className="label">Medicine Name *</label>
                <input name="medicineName" className="input-field" value={editForm.medicineName} onChange={handleEditChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Urgency</label>
                  <select name="urgency" className="select-field" value={editForm.urgency} onChange={handleEditChange}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" name="quantity" min="1" className="input-field" value={editForm.quantity} onChange={handleEditChange} />
                </div>
              </div>
              <div>
                <label className="label">City</label>
                <select name="city" className="select-field" value={editForm.city} onChange={handleEditChange}>
                  <option value="">Select city</option>
                  <option>Karachi</option>
                  <option>Lahore</option>
                  <option>Islamabad</option>
                  <option>Rawalpindi</option>
                  <option>Faisalabad</option>
                  <option>Peshawar</option>
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea name="description" className="input-field" rows={3} value={editForm.description} onChange={handleEditChange} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeEdit} className="btn-secondary flex-1" disabled={editLoading}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 gap-2" disabled={editLoading}>
                  <Save className="w-4 h-4" /> {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
