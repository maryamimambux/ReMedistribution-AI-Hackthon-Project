import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { Shield, CheckCircle, XCircle, Package, Search, QrCode, Camera, CameraOff, MapPin, Phone, Truck, Timer, User, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';

const QR_READER_ID = 'pickup-qr-reader';

export default function PickupVerification() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Camera scanner state
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  // Queue state
  const [readyMatches, setReadyMatches] = useState([]);
  const [pickedUpMatches, setPickedUpMatches] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [completingId, setCompletingId] = useState(null);

  const fetchQueues = useCallback(async () => {
    setQueueLoading(true);
    try {
      const [readyRes, pickedRes] = await Promise.all([
        api.get('/matching?status=READY_FOR_PICKUP&limit=50'),
        api.get('/matching?status=PICKED_UP&limit=50'),
      ]);
      setReadyMatches(readyRes.data.data || []);
      setPickedUpMatches(pickedRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load pickup queues');
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  // Ensure the camera stream is stopped when leaving the page
  useEffect(() => {
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Camera QR scanning ──────────────────────────────────────────

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // scanner already stopped
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleScanned = useCallback(async (decodedText) => {
    await stopScanner();
    let pickupCode = null;
    let matchId = null;
    try {
      const payload = JSON.parse(decodedText);
      pickupCode = payload.pickupCode;
      matchId = payload.matchId || null;
    } catch {
      // Plain QR content — accept it if it is a bare 6-digit code
      if (/^\d{6}$/.test(decodedText.trim())) pickupCode = decodedText.trim();
    }
    if (!pickupCode) {
      toast.error('Scanned QR code is not a valid pickup code');
      return;
    }
    setCode(pickupCode);
    submitVerification(pickupCode, matchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopScanner]);

  const startScanner = async () => {
    setResult(null);
    if (scanning) return;
    try {
      const scanner = new Html5Qrcode(QR_READER_ID, { verbose: false });
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => handleScanned(decodedText),
        () => {} // per-frame decode errors are noise — ignore
      );
    } catch (err) {
      setScanning(false);
      scannerRef.current = null;
      toast.error(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied — enter the 6-digit code manually instead.'
          : 'Could not start the camera. Enter the 6-digit code manually instead.'
      );
    }
  };

  // ── Verification (shared by scan + manual entry) ────────────────

  const submitVerification = async (pickupCode, matchId) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/matching/verify-code', { code: pickupCode, matchId: matchId || undefined });
      setResult({ success: true, message: 'Pickup verified! Medicine marked as Picked Up and inventory dispatched.', data: res.data.data });
      toast.success('Pickup verified!');
      fetchQueues();
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.message || 'Verification failed',
      });
    } finally {
      setLoading(false);
      setCode('');
    }
  };

  const handleManualVerify = (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }
    submitVerification(code, null);
  };

  // ── Mark as Delivered ───────────────────────────────────────────

  const markDelivered = async (match) => {
    if (!window.confirm(`Confirm that ${match.patientRequest?.patient?.name} physically received the medicine? This finalizes the request.`)) return;
    setCompletingId(match.id);
    try {
      await api.patch(`/matching/${match.id}/complete`);
      toast.success('Marked as Delivered — request fulfilled!');
      fetchQueues();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark as delivered');
    } finally {
      setCompletingId(null);
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

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Shield className="w-6 h-6 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pickup Verification</h1>
          <p className="text-gray-500">Scan the patient's QR code — or enter their 6-digit pickup code — to confirm collection</p>
        </div>
      </div>

      {/* QR scanner */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-700" />
            <h2 className="font-semibold text-gray-900">Scan QR Code</h2>
          </div>
          {scanning ? (
            <button onClick={stopScanner} className="btn-secondary text-sm gap-2 py-2 px-4">
              <CameraOff className="w-4 h-4" /> Stop Camera
            </button>
          ) : (
            <button onClick={startScanner} className="btn-primary text-sm gap-2 py-2 px-4">
              <Camera className="w-4 h-4" /> Start Camera Scan
            </button>
          )}
        </div>
        {scanning ? (
          <div className="space-y-2">
            <div id={QR_READER_ID} className="w-full max-w-sm mx-auto rounded-xl overflow-hidden border-2 border-emerald-200" />
            <p className="text-xs text-gray-500 text-center">Point the camera at the patient's QR code — it will be detected automatically.</p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl py-8 text-center">
            <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">The patient shows their QR code from the "My Requests" page.</p>
          </div>
        )}
      </div>

      {/* Manual code entry */}
      <form onSubmit={handleManualVerify} className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Or Enter Pickup Code Manually</label>
        <div className="flex gap-3">
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input-field flex-1 text-center text-2xl font-mono tracking-[0.5em] placeholder:text-gray-300"
            placeholder="000000"
            maxLength={6}
          />
          <button type="submit" disabled={loading || code.length !== 6} className="btn-primary px-8 disabled:opacity-50">
            {loading ? '...' : 'Verify'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`mt-4 rounded-xl border p-4 ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>{result.message}</p>
                {result.success && result.data && (
                  <div className="mt-2 text-sm text-gray-700 space-y-1">
                    <p className="flex items-center gap-1.5"><User className="w-4 h-4 text-gray-400" /> {result.data.patientRequest?.patient?.name}</p>
                    <p className="flex items-center gap-1.5"><Package className="w-4 h-4 text-gray-400" /> {result.data.inventoryItem?.medicine?.name}</p>
                    <p className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" /> {result.data.inventoryItem?.center?.name}</p>
                    <p className="flex items-center gap-1.5 text-green-700 font-medium">
                      <Truck className="w-4 h-4" /> Status: Picked Up — inventory dispatched
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Picked Up — awaiting delivery confirmation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">Picked Up — Awaiting Delivery Confirmation</h2>
        <button onClick={fetchQueues} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
          <Search className="w-4 h-4" /> Refresh
        </button>
      </div>

      {queueLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : pickedUpMatches.length === 0 ? (
        <div className="card text-center py-8 mb-8">
          <Truck className="w-12 h-12 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Nothing awaiting delivery confirmation</p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {pickedUpMatches.map((m) => (
            <div key={m.id} className="card border-green-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {m.patientRequest?.patient?.name} — {m.inventoryItem?.medicine?.name}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {m.inventoryItem?.center?.name}, {m.inventoryItem?.center?.city}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Picked up — awaiting delivery confirmation
                  </p>
                </div>
                <button
                  onClick={() => markDelivered(m)}
                  disabled={completingId === m.id}
                  className="btn-primary text-sm gap-2 py-2 px-4"
                >
                  {completingId === m.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Confirming…
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" /> Mark as Delivered
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ready-for-pickup queue */}
      <h2 className="section-title">Ready for Pickup</h2>
      {queueLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : readyMatches.length === 0 ? (
        <div className="card text-center py-12">
          <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500">No pickups waiting</p>
        </div>
      ) : (
        <div className="space-y-3">
          {readyMatches.map((m) => (
            <div key={m.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">
                  {m.patientRequest?.patient?.name} — {m.inventoryItem?.medicine?.name}
                </p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {m.inventoryItem?.center?.name}, {m.inventoryItem?.center?.city}
                </p>
                {m.patientRequest?.patient?.phone && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {m.patientRequest.patient.phone}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Matched {new Date(m.matchedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-mono font-bold text-emerald-700">{m.pickupCode}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                  <Timer className="w-3 h-3" />
                  {m.pickupCodeExpiresAt ? countdown(m.pickupCodeExpiresAt) : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
