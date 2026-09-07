import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  Package,
  User,
  Calendar,
  Thermometer,
  ClipboardCheck,
  FileText,
  History,
  ChevronDown,
  ChevronUp,
  Eye,
  RotateCcw,
  Building2,
  Hash,
  Pill,
} from 'lucide-react';

const REJECTION_REASONS = [
  'Expired',
  'Tampered',
  'Counterfeit suspected',
  'Seal broken',
  'Incomplete info',
  'Other',
];

const RISK_META = {
  LOW: { label: 'Low Risk', color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-100' },
  MEDIUM: { label: 'Medium Risk', color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-100' },
  HIGH: { label: 'High Risk', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-100' },
};

/**
 * Defensively parse a field that may arrive as a JSON string or an object/array.
 * This protects against stale backend responses or direct DB inconsistencies.
 */
function safeParse(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * Heuristic parser for the raw OCR text line that the backend builds:
 * "<medicine> <dosage> | <manufacturer> | Batch: <batch> | Exp: <YYYY-MM>".
 * Returns an object matching the aiOcr.fields shape, or null if nothing useful
 * could be extracted.
 */
function parseScannedText(text) {
  if (!text || typeof text !== 'string') return null;

  const fields = {
    medicineName: null,
    dosage: null,
    manufacturer: null,
    batchNumber: null,
    expiryDate: null,
    category: null,
  };

  const batchMatch = text.match(/batch[:#\s]+([a-zA-Z0-9\-]+)/i);
  if (batchMatch) fields.batchNumber = batchMatch[1];

  const expMatch = text.match(/exp[:\s]+(\d{4}-\d{2}(?:-\d{2})?)/i);
  if (expMatch) fields.expiryDate = expMatch[1];

  // The text is structured as "<name> <dosage> | <manufacturer> | ..."
  const segments = text.split('|').map((s) => s.trim());
  if (segments[0]) {
    // First segment is "medicineName dosage" (dosage is optional)
    const first = segments[0];
    const dosageMatch = first.match(/(\d+(?:\.\d+)?\s*(?:mg|ml|iu|g|mcg|units?|tablets?|capsules?))/i);
    if (dosageMatch) {
      fields.dosage = dosageMatch[1];
      const namePart = first.slice(0, dosageMatch.index).trim();
      if (namePart) fields.medicineName = namePart;
    } else {
      fields.medicineName = first;
    }
  }
  if (segments[1]) {
    fields.manufacturer = segments[1];
  }

  const hasValue = Object.values(fields).some((v) => v);
  return hasValue ? fields : null;
}

export default function VerifyDonation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [donation, setDonation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [checklist, setChecklist] = useState({
    sealIntact: '',
    packagingMatch: '',
    coldChain: '',
    batchExpiry: '',
    notes: '',
  });

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDonation() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/donations/${id}`);
        if (!cancelled) {
          setDonation(res.data.data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err.response?.data?.message || 'Failed to load donation';
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDonation();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!donation) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donation?.id]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/donations/${id}/verifications`);
      setHistory(res.data.data || []);
    } catch (err) {
      console.error('Failed to load verification history', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  const photos = useMemo(() => {
    if (!donation) return [];
    return Array.isArray(donation.photos)
      ? donation.photos
      : safeParse(donation.photos, []);
  }, [donation]);

  const aiOcr = useMemo(() => {
    if (!donation) return null;
    const parsed = donation.aiOcrResult ? safeParse(donation.aiOcrResult, null) : null;
    if (!parsed) return null;

    // If the backend stored no usable structured fields, derive them from the
    // raw scanned text so the pharmacist still has an AI column to compare.
    const fieldsEmpty =
      !parsed.fields ||
      Object.values(parsed.fields).every((v) => v === null || v === undefined || String(v).trim() === '');
    if (fieldsEmpty && donation.scannedText) {
      const fallback = parseScannedText(donation.scannedText);
      if (fallback) {
        return { ...parsed, fields: fallback, source: parsed.source || 'ocr-fallback' };
      }
    }
    return parsed;
  }, [donation]);

  const aiVision = useMemo(() => {
    if (!donation) return null;
    return donation.aiVisionResult ? safeParse(donation.aiVisionResult, null) : null;
  }, [donation]);

  const hasAiData = Boolean(
    donation?.aiRiskScore || aiOcr || aiVision || donation?.scannedText
  );

  const isChecklistComplete = useMemo(() => {
    return (
      checklist.sealIntact !== '' &&
      checklist.packagingMatch !== '' &&
      checklist.coldChain !== '' &&
      checklist.batchExpiry !== '' &&
      checklist.notes.trim() !== ''
    );
  }, [checklist]);

  function updateChecklist(field, value) {
    setChecklist((prev) => ({ ...prev, [field]: value }));
  }

  async function handleDecision(decision) {
    if (!isChecklistComplete) {
      toast.error('Please complete the manual checklist and add notes before deciding.');
      return;
    }

    if (decision === 'REJECTED') {
      if (!rejectReason) {
        setShowRejectModal(true);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        status: decision,
        checklist,
        notes: checklist.notes,
      };
      if (decision === 'REJECTED') {
        payload.reason = rejectReason;
        if (rejectNote.trim()) payload.notes = `${checklist.notes}\n\nRejection note: ${rejectNote}`.trim();
      }

      await api.patch(`/donations/${id}/verify`, payload);
      toast.success(`Donation ${decision === 'APPROVED' ? 'approved' : 'rejected'}`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  function openRejectModal() {
    if (!isChecklistComplete) {
      toast.error('Please complete the manual checklist and add notes before rejecting.');
      return;
    }
    setRejectReason('');
    setRejectNote('');
    setShowRejectModal(true);
  }

  function confirmReject() {
    if (!rejectReason) {
      toast.error('Please select a rejection reason');
      return;
    }
    setShowRejectModal(false);
    handleDecision('REJECTED');
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error || !donation) {
    return (
      <div className="page-container text-center py-20 max-w-2xl mx-auto">
        <div className="card space-y-6">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Unable to load donation</h2>
          <p className="text-gray-500">{error || 'Donation not found'}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const medicine = donation.medicine || {};
  const donor = donation.donor || {};
  const center = donation.center || {};
  const risk = RISK_META[donation.aiRiskScore] || null;

  return (
    <div className="page-container max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Verify Donation</h1>
          <p className="text-gray-500 mt-1">
            Review AI pre-screening, inspect the medicine, and record your final decision.
          </p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary self-start">
          <RotateCcw className="w-4 h-4" /> Back to Queue
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column — Summary + Photos */}
        <div className="lg:col-span-1 space-y-6">
          {/* Donation Summary */}
          <div className="card space-y-5">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" /> Donation Summary
            </h2>

            <div className="space-y-3 text-sm">
              <SummaryRow icon={<Pill className="w-4 h-4" />} label="Medicine" value={medicine.name} />
              <SummaryRow label="Dosage" value={medicine.dosage || 'N/A'} />
              <SummaryRow label="Category" value={medicine.category || 'N/A'} />
              <SummaryRow label="Manufacturer" value={medicine.manufacturer || 'N/A'} />
              <SummaryRow icon={<Hash className="w-4 h-4" />} label="Batch #" value={donation.batchNumber || 'N/A'} mono />
              <SummaryRow icon={<Calendar className="w-4 h-4" />} label="Expiry" value={formatDate(donation.expiryDate)} />
              <SummaryRow label="Quantity" value={donation.quantity} />

              <hr className="border-gray-100" />

              <SummaryRow icon={<User className="w-4 h-4" />} label="Donor" value={donor.name || 'N/A'} />
              <SummaryRow label="Donor ID" value={donor.id || 'N/A'} mono />
              <SummaryRow icon={<Calendar className="w-4 h-4" />} label="Donation Date" value={formatDate(donation.createdAt)} />
              <SummaryRow icon={<Building2 className="w-4 h-4" />} label="Center" value={center.name || 'Not assigned'} />
            </div>
          </div>

          {/* Photos */}
          <div className="card space-y-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-600" /> Submitted Photos
            </h2>
            {photos.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-sm">
                No photos were submitted with this donation.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo, i) => (
                  <a
                    key={i}
                    href={photo}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square bg-gray-100 rounded-xl overflow-hidden hover:opacity-90 transition-opacity group relative"
                    title={`Open photo ${i + 1}`}
                  >
                    <img
                      src={photo}
                      alt={`Submitted photo ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/vite.svg';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                      {i + 1}/{photos.length}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right columns — AI + Checklist + Actions + History */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Pre-Screening Panel */}
          <div className="card space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600" /> AI Pre-Screening
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  AI-Assisted — Pharmacist judgment is final
                </p>
              </div>
              {risk && (
                <span className={`badge ${risk.bg} ${risk.text}`}>
                  {risk.label}
                </span>
              )}
            </div>

            {!hasAiData ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-700">AI check unavailable</p>
                  <p className="text-sm text-gray-500 mt-1">
                    The AI service was not available when this donation was scanned. Please verify
                    all details manually using the checklist below.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Risk meter */}
                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                      risk ? risk.color : 'bg-gray-200'
                    }`}
                  >
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">
                      {risk ? risk.label : 'Unknown Risk'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {donation.aiConfidence !== null && donation.aiConfidence !== undefined
                        ? `Confidence: ${Math.round(donation.aiConfidence * 100)}%`
                        : 'Confidence unavailable'}
                    </div>
                  </div>
                </div>

                {/* OCR side-by-side */}
                <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-100/50 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">OCR vs Donor-Entered</span>
                    {aiOcr?.confidence !== undefined && (
                      <span className="ml-auto text-xs text-gray-500">
                        OCR confidence: {Math.round(aiOcr.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="px-4 py-2 font-medium">Field</th>
                          <th className="px-4 py-2 font-medium">Donor-Entered</th>
                          <th className="px-4 py-2 font-medium">AI OCR</th>
                          <th className="px-4 py-2 font-medium">Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        <ComparisonRow
                          label="Medicine"
                          donor={medicine.name}
                          ai={aiOcr?.fields?.medicineName}
                        />
                        <ComparisonRow
                          label="Dosage"
                          donor={medicine.dosage}
                          ai={aiOcr?.fields?.dosage}
                        />
                        <ComparisonRow
                          label="Category"
                          donor={medicine.category}
                          ai={aiOcr?.fields?.category}
                        />
                        <ComparisonRow
                          label="Manufacturer"
                          donor={medicine.manufacturer}
                          ai={aiOcr?.fields?.manufacturer}
                        />
                        <ComparisonRow
                          label="Batch #"
                          donor={donation.batchNumber}
                          ai={aiOcr?.fields?.batchNumber}
                        />
                        <ComparisonRow
                          label="Expiry"
                          donor={formatDate(donation.expiryDate)}
                          ai={aiOcr?.fields?.expiryDate}
                        />
                      </tbody>
                    </table>
                  </div>
                  {donation.scannedText && (
                    <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-600">
                      <span className="font-semibold">Raw OCR text:</span> {donation.scannedText}
                    </div>
                  )}
                </div>

                {/* Vision flags */}
                {aiVision && (
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">AI Vision Check</span>
                      <span className="ml-auto text-xs text-gray-500">
                        Confidence: {Math.round((aiVision.confidence || 0) * 100)}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <VisionBadge
                        label="Seal Intact"
                        value={aiVision.sealIntact}
                        goodIf
                      />
                      <VisionBadge
                        label="Damaged"
                        value={aiVision.damaged}
                        goodIf={false}
                      />
                      <VisionBadge
                        label="Tampered"
                        value={aiVision.tampered}
                        goodIf={false}
                      />
                      <VisionBadge
                        label="Label Readable"
                        value={aiVision.labelReadable}
                        goodIf
                      />
                    </div>
                    {Array.isArray(aiVision.flags) && aiVision.flags.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-yellow-800 mb-1">AI observations</p>
                        <ul className="text-sm text-yellow-800 list-disc list-inside space-y-0.5">
                          {aiVision.flags.map((flag, i) => (
                            <li key={i}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {donation.aiNotes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <p className="text-sm text-yellow-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {donation.aiNotes}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Manual Verification Checklist */}
          <div className="card space-y-5">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-600" /> Manual Verification Checklist
            </h2>

            <ChecklistQuestion
              question="Seal physically confirmed intact?"
              value={checklist.sealIntact}
              onChange={(value) => updateChecklist('sealIntact', value)}
              options={['YES', 'NO']}
            />

            <ChecklistQuestion
              question="Packaging matches AI assessment?"
              value={checklist.packagingMatch}
              onChange={(value) => updateChecklist('packagingMatch', value)}
              options={['YES', 'NO', 'OVERRIDE']}
            />

            <ChecklistQuestion
              question="Cold-chain storage verified (if applicable)?"
              value={checklist.coldChain}
              onChange={(value) => updateChecklist('coldChain', value)}
              options={['YES', 'NO', 'N/A']}
              hint={medicine.requiresColdChain ? 'This medicine requires cold-chain storage.' : undefined}
            />

            <ChecklistQuestion
              question="Batch/expiry visually confirmed?"
              value={checklist.batchExpiry}
              onChange={(value) => updateChecklist('batchExpiry', value)}
              options={['YES', 'NO']}
            />

            <div>
              <label className="label flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" /> Inspection Notes
              </label>
              <textarea
                className="input-field"
                rows={4}
                placeholder="Describe what you observed during physical inspection..."
                value={checklist.notes}
                onChange={(e) => updateChecklist('notes', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Required. Include any discrepancies or concerns.</p>
            </div>
          </div>

          {/* Decision Actions */}
          <div className="card space-y-4">
            <h2 className="font-bold text-gray-900">Your Decision</h2>
            {!isChecklistComplete && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Complete the checklist and add inspection notes to enable Approve / Reject.
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleDecision('APPROVED')}
                className="btn-primary flex-1 gap-2"
                disabled={!isChecklistComplete || submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </span>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" /> Approve Donation
                  </>
                )}
              </button>
              <button
                onClick={openRejectModal}
                className="btn-danger flex-1 gap-2"
                disabled={!isChecklistComplete || submitting}
              >
                <XCircle className="w-5 h-5" /> Reject Donation
              </button>
            </div>
          </div>

          {/* Audit Log / Verification History */}
          <div className="card space-y-4">
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" /> Verification History
              </h2>
              {showHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {showHistory && (
              <div className="space-y-3">
                {historyLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-gray-500">No verification decisions recorded yet.</p>
                ) : (
                  history.map((record) => (
                    <div
                      key={record.id}
                      className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`badge ${
                            record.decision === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {record.decision}
                        </span>
                        <span className="text-xs text-gray-500">{formatDateTime(record.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Pharmacist:</span>{' '}
                        {record.pharmacist?.name || 'Unknown'} ({record.pharmacist?.id})
                      </p>
                      {record.reason && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Reason:</span> {record.reason}
                        </p>
                      )}
                      {record.notes && (
                        <p className="text-sm text-gray-600 bg-white rounded-lg p-2 border border-gray-100">
                          {record.notes}
                        </p>
                      )}
                      {record.checklist && Object.keys(record.checklist).length > 0 && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-emerald-700 font-medium">
                            Checklist answers
                          </summary>
                          <ul className="mt-2 space-y-1 text-gray-600 list-disc list-inside">
                            <li>Seal intact: {record.checklist.sealIntact || '—'}</li>
                            <li>Packaging match: {record.checklist.packagingMatch || '—'}</li>
                            <li>Cold chain: {record.checklist.coldChain || '—'}</li>
                            <li>Batch/expiry confirmed: {record.checklist.batchExpiry || '—'}</li>
                          </ul>
                        </details>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" /> Reject Donation
            </h3>
            <p className="text-sm text-gray-500">
              Select a reason for rejection. The donor will be notified.
            </p>

            <div className="space-y-2">
              {REJECTION_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    rejectReason === reason
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="rejectReason"
                    value={reason}
                    checked={rejectReason === reason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm font-medium text-gray-700">{reason}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="label">Additional rejection note (optional)</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Add any extra context..."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="btn-secondary flex-1"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="btn-danger flex-1"
                disabled={submitting}
              >
                {submitting ? 'Processing...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ icon, label, value, mono }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-gray-500 flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={`font-medium text-gray-900 text-right ${mono ? 'font-mono' : ''}`}>
        {value ?? 'N/A'}
      </span>
    </div>
  );
}

function ComparisonRow({ label, donor, ai }) {
  const donorVal = donor && String(donor).trim() !== '' ? String(donor) : null;
  const aiVal = ai && String(ai).trim() !== '' ? String(ai) : null;
  const matches = donorVal && aiVal && donorVal.toLowerCase() === aiVal.toLowerCase();

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="px-4 py-2.5 text-gray-600">{label}</td>
      <td className="px-4 py-2.5 font-medium text-gray-900">{donorVal || '—'}</td>
      <td className="px-4 py-2.5 font-medium text-gray-900">{aiVal || '—'}</td>
      <td className="px-4 py-2.5">
        {matches ? (
          <span className="badge badge-green">Match</span>
        ) : donorVal && aiVal ? (
          <span className="badge badge-yellow">Mismatch</span>
        ) : (
          <span className="badge badge-gray">—</span>
        )}
      </td>
    </tr>
  );
}

function VisionBadge({ label, value, goodIf }) {
  const isGood = value === goodIf;
  const isUnknown = value === null || value === undefined;

  return (
    <span
      className={`badge ${
        isUnknown
          ? 'bg-gray-100 text-gray-600'
          : isGood
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {label}: {isUnknown ? 'Unknown' : value ? 'Yes' : 'No'}
    </span>
  );
}

function ChecklistQuestion({ question, value, onChange, options, hint }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{question}</p>
        {hint && (
          <span className="text-xs text-blue-600 flex items-center gap-1 flex-shrink-0">
            <Thermometer className="w-3 h-3" /> {hint}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              value === option
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-400 hover:text-emerald-700'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
