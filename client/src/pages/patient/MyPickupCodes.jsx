import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  QrCode, Package, MapPin, Timer, ClipboardList,
} from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';
import PatientTabs from '../../components/PatientTabs';

export default function MyPickupCodes() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrCodes, setQrCodes] = useState({}); // matchId -> qr data

  const fetchQR = async (matchId) => {
    try {
      const res = await api.get(`/matching/${matchId}/qrcode`);
      setQrCodes((prev) => ({ ...prev, [matchId]: res.data.data }));
    } catch (err) {
      // silent
    }
  };

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/patients/my-requests?limit=50');
      setRequests(res.data.data);

      // Fetch QR codes for every READY_FOR_PICKUP match
      for (const req of res.data.data) {
        for (const m of req.matches || []) {
          if (m.status === 'READY_FOR_PICKUP') {
            fetchQR(m.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch pickup codes:', err);
      toast.error('Failed to load pickup codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time updates so codes appear or disappear as the match status changes
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

  // Flatten all READY_FOR_PICKUP matches with their parent request info
  const pickupItems = useMemo(() => {
    const items = [];
    for (const req of requests) {
      for (const m of req.matches || []) {
        if (m.status === 'READY_FOR_PICKUP') {
          items.push({ request: req, match: m });
        }
      }
    }
    return items;
  }, [requests]);

  const countdown = (expiresAt) => {
    if (!expiresAt) return '';
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  return (
    <div className="page-container">
      <PatientTabs />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Pickup Codes</h1>
          <p className="text-gray-500 mt-1">
            All active pickup codes and QR codes in one place — even if your notifications are cleared.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : pickupItems.length === 0 ? (
        <div className="card text-center py-16">
          <QrCode className="w-20 h-20 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">No pickup codes yet</h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            When a match is ready for collection, the pickup code and QR code will appear here.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {pickupItems.map(({ request, match }) => {
            const qr = qrCodes[match.id];
            const center = match.inventoryItem?.center;
            const medicine = match.inventoryItem?.medicine;

            return (
              <div key={match.id} className="card border-yellow-200">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-yellow-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-lg truncate">{request.medicineName}</h3>
                    <p className="text-sm text-gray-500">
                      Qty: {request.quantity} · {request.city || request.location || 'N/A'}
                    </p>
                    {medicine?.name && (
                      <p className="text-xs text-gray-500 mt-0.5">Matched with: {medicine.name}</p>
                    )}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 mb-4">
                  <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">Ready for Pickup</p>
                  <p className="text-sm font-medium text-gray-900 flex items-start gap-1">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="truncate">
                      {center?.name}, {center?.address}, {center?.city}
                    </span>
                  </p>
                </div>

                {qr ? (
                  <div className="bg-white rounded-xl p-4 border border-yellow-200">
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                      <div className="flex-shrink-0 mx-auto sm:mx-0">
                        <img src={qr.qrImage} alt="Pickup QR" className="w-32 h-32 rounded-lg" />
                      </div>
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <QrCode className="w-4 h-4 text-yellow-700" />
                          <span className="text-sm font-bold text-yellow-800">Pickup Code</span>
                        </div>
                        <p className="text-3xl font-mono font-bold text-emerald-700 tracking-widest mb-2">
                          {qr.pickupCode}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-yellow-700 mb-2">
                          <Timer className="w-3 h-3" />
                          <span>{countdown(qr.expiresAt)}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Show this code at {center?.name || 'the collection center'} to collect your medicine.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-8 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          to="/my-requests"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          <ClipboardList className="w-4 h-4" />
          View full request history
        </Link>
      </div>
    </div>
  );
}
