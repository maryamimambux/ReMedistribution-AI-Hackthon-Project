import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Camera,
  Upload,
  Check,
  AlertTriangle,
  MapPin,
  RefreshCw,
  X,
  AlertCircle,
  Trash2,
  ImagePlus,
  ScanLine,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function DonateMedicine() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  const [step, setStep] = useState(1);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Camera / image state (up to 3 images for front, expiry side, manufacturer side)
  const [cameraMode, setCameraMode] = useState(false);
  const [images, setImages] = useState([]); // { file, preview }

  // AI results
  const [visionResult, setVisionResult] = useState(null);

  const [form, setForm] = useState({
    medicineName: '',
    category: '',
    manufacturer: '',
    dosage: '',
    form: '',
    batchNumber: '',
    expiryDate: '',
    quantity: 1,
    sealIntact: true,
    storageVerified: false,
    centerId: '',
    scannedText: '',
    ocrConfidence: 0,
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ─── Camera helpers ─────────────────────────────────────────────────

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraMode(true);
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Could not access camera. Use file upload instead.');
      setCameraMode(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraMode(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const captureImage = () => {
    if (!videoRef.current || !streamRef.current) return;
    if (images.length >= 3) {
      toast.error('Maximum 3 images allowed');
      stopCamera();
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        const file = new File([blob], `medicine-label-${images.length + 1}.jpg`, { type: 'image/jpeg' });
        setImages((prev) => [...prev, { file, preview: URL.createObjectURL(blob) }]);
        stopCamera();
      },
      'image/jpeg',
      0.9
    );
  };

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const remainingSlots = 3 - images.length;
    if (remainingSlots <= 0) {
      toast.error('Maximum 3 images allowed');
      return;
    }

    const toProcess = selectedFiles.slice(0, remainingSlots);
    const newImages = [];

    for (const file of toProcess) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error('Only JPEG, PNG, or WebP images allowed');
        continue;
      }

      try {
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1200,
          maxSizeMB: 1,
          useWebWorker: true,
          initialQuality: 0.7,
        });
        const compressedFile = new File([compressed], file.name, { type: compressed.type });
        newImages.push({ file: compressedFile, preview: URL.createObjectURL(compressed) });
      } catch (err) {
        console.warn('Compression failed, using original:', err);
        newImages.push({ file, preview: URL.createObjectURL(file) });
      }
    }

    setImages((prev) => [...prev, ...newImages]);
    setCameraMode(false);
    if (newImages.length > 0) {
      toast.success(`${newImages.length} image(s) added`);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
    setVisionResult(null);
  };

  const clearImages = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setVisionResult(null);
  };

  // ─── AI Scan ─────────────────────────────────────────────────────────

  const scanImages = async () => {
    if (images.length === 0) {
      toast.error('Please capture or upload at least one image first');
      return;
    }

    setScanning(true);
    try {
      // 1. OCR — send all images so the model can pick the best values
      const ocrForm = new FormData();
      images.forEach((img) => ocrForm.append('images', img.file));
      const ocrRes = await api.post('/ai/ocr', ocrForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      const ocrData = ocrRes.data?.data || ocrRes.data;

      // Check if AI is actually available
      const aiUnavailable = ocrRes.data?.aiAvailable === false || ocrData?.confidence === 0;

      // 2. Vision check — also uses all images
      let visionData;
      try {
        const visionForm = new FormData();
        images.forEach((img) => visionForm.append('images', img.file));
        const visionRes = await api.post('/ai/vision', visionForm, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });
        visionData = visionRes.data?.data || visionRes.data;
      } catch (visionErr) {
        console.error('Vision check failed:', visionErr);
        visionData = null;
      }

      const fields = ocrData?.fields || {};

      setForm((prev) => ({
        ...prev,
        medicineName: fields.medicineName || prev.medicineName,
        category: fields.category || prev.category,
        manufacturer: fields.manufacturer || prev.manufacturer,
        dosage: fields.dosage || prev.dosage,
        batchNumber: fields.batchNumber || prev.batchNumber,
        expiryDate: normalizeExpiry(fields.expiryDate) || prev.expiryDate,
        scannedText: ocrData?.text || '',
        ocrConfidence: ocrData?.confidence || 0,
        sealIntact: visionData ? visionData.sealIntact : prev.sealIntact,
      }));

      setVisionResult(visionData);

      if (fields.medicineName && !aiUnavailable) {
        toast.success('Label scanned successfully!');
        setStep(2);
      } else if (aiUnavailable) {
        toast.error(
          'AI service is not running. Start it with start-ai.ps1 (or start-all.ps1), then try again.',
          { duration: 6000 }
        );
      } else {
        toast.error('Could not read label clearly. Please enter details manually.');
      }
    } catch (err) {
      console.error('Scan error:', err);
      toast.error(err.response?.data?.message || 'Scan failed. Please enter details manually.');
    } finally {
      setScanning(false);
    }
  };

  const normalizeExpiry = (value) => {
    if (!value) return '';
    // Convert "2027-06" or "2027-06-01" to "2027-06" for month input
    const m = value.match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : value;
  };

  // ─── Form flow ───────────────────────────────────────────────────────

  const fetchCenters = async () => {
    try {
      const res = await api.get('/centers');
      setCenters(res.data.data.filter((c) => c.isActive));
    } catch (err) {
      console.error('Failed to fetch centers:', err);
    }
  };

  const goToStep = (s) => {
    if (s === 3) fetchCenters();
    setStep(s);
  };

  const handleSubmit = async () => {
    if (!form.centerId) {
      toast.error('Please select a collection center');
      return;
    }

    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('medicineName', form.medicineName);
      payload.append('category', form.category);
      payload.append('manufacturer', form.manufacturer);
      payload.append('dosage', form.dosage);
      payload.append('form', form.form);
      payload.append('batchNumber', form.batchNumber);
      payload.append('expiryDate', form.expiryDate);
      payload.append('quantity', String(form.quantity));
      payload.append('sealIntact', String(form.sealIntact));
      payload.append('storageVerified', String(form.storageVerified));
      payload.append('centerId', form.centerId);
      payload.append('scannedText', form.scannedText);
      payload.append('ocrConfidence', String(form.ocrConfidence));

      // Persist full OCR and vision snapshots for pharmacist verification
      const ocrData = {
        text: form.scannedText || '',
        fields: {
          medicineName: form.medicineName || null,
          batchNumber: form.batchNumber || null,
          expiryDate: form.expiryDate || null,
          manufacturer: form.manufacturer || null,
          dosage: form.dosage || null,
          category: form.category || null,
        },
        confidence: parseFloat(form.ocrConfidence) || 0,
        source: 'ocr',
      };
      payload.append('ocrResult', JSON.stringify(ocrData));

      if (visionResult) {
        payload.append(
          'visionResult',
          JSON.stringify({
            sealIntact: visionResult.sealIntact,
            tampered: visionResult.tampered,
            damaged: visionResult.damaged,
            labelReadable: visionResult.labelReadable,
            confidence: visionResult.confidence,
            flags: visionResult.flags || [],
            source: visionResult.source || 'vision',
          })
        );
      }

      // Attach scanned images as donation photos (up to 3)
      images.forEach((img) => payload.append('photos', img.file));

      await api.post('/donations', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Donation submitted! Take the medicine to your selected center.');
      navigate('/my-donations');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit donation');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="page-container max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Donate Medicine</h1>
      <p className="text-gray-500 mb-8">Scan up to 3 sides of the medicine box, verify, and book a drop-off</p>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                step >= s ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > s ? <Check className="w-5 h-5" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-1 mx-2 rounded transition-all ${
                  step > s ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Scan / Enter medicine info */}
      {step === 1 && (
        <div className="card space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-600" /> Step 1: Scan Medicine Label
          </h2>

          <p className="text-sm text-gray-600">
            You can add up to <strong>3 images</strong> (e.g. front label, expiry/batch side, manufacturer side) so the
            AI can read everything accurately.
          </p>

          {/* Camera / Upload area */}
          <div className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-2xl p-4 text-center space-y-4">
            {!cameraMode && images.length === 0 && (
              <>
                <Camera className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={startCamera} className="btn-primary text-base">
                    Open Camera
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary text-base"
                  >
                    <Upload className="w-4 h-4" /> Upload Photo
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                  multiple
                />
                <p className="text-sm text-gray-500">Point your camera at the medicine box label, or upload clear photos</p>
              </>
            )}

            {!cameraMode && images.length > 0 && images.length < 3 && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={startCamera} className="btn-secondary text-base">
                  <Camera className="w-4 h-4" /> Add Another Photo
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-base"
                >
                  <ImagePlus className="w-4 h-4" /> Upload More
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                  multiple
                />
              </div>
            )}

            {cameraMode && (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-80 rounded-xl bg-black"
                />
                <div className="flex gap-3 justify-center">
                  <button onClick={captureImage} className="btn-primary">
                    Capture Image {images.length + 1}/3
                  </button>
                  <button onClick={stopCamera} className="btn-secondary">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Thumbnails */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img.preview}
                      alt={`Medicine image ${idx + 1}`}
                      className="w-full h-28 object-cover rounded-xl border border-emerald-200"
                    />
                    <div className="absolute top-1 left-1 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {idx === 0 ? 'Front' : idx === 1 ? 'Side 1' : 'Side 2'}
                    </div>
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button onClick={scanImages} disabled={scanning} className="btn-primary">
                  {scanning ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Scanning with AI...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ScanLine className="w-4 h-4" /> Scan {images.length} Image{images.length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
                <button onClick={clearImages} className="btn-secondary">
                  <RefreshCw className="w-4 h-4" /> Start Over
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-400">or enter manually</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Medicine Name *</label>
              <input
                name="medicineName"
                className="input-field"
                placeholder="e.g. Glimepiride"
                value={form.medicineName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select name="category" className="select-field" value={form.category} onChange={handleChange}>
                <option value="">Select</option>
                <option>Diabetes</option>
                <option>Cardiovascular</option>
                <option>Antibiotics</option>
                <option>Pain Relief</option>
                <option>Respiratory</option>
                <option>Gastrointestinal</option>
              </select>
            </div>
            <div>
              <label className="label">Batch Number</label>
              <input
                name="batchNumber"
                className="input-field"
                placeholder="e.g. GLM2025A1"
                value={form.batchNumber}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Expiry Date</label>
              <input
                name="expiryDate"
                type="month"
                className="input-field"
                value={form.expiryDate}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Manufacturer</label>
              <input
                name="manufacturer"
                className="input-field"
                placeholder="e.g. Getz Pharma"
                value={form.manufacturer}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input
                name="quantity"
                type="number"
                min="1"
                className="input-field"
                value={form.quantity}
                onChange={handleChange}
              />
            </div>
          </div>

          <button onClick={() => goToStep(2)} className="btn-primary w-full" disabled={!form.medicineName}>
            Continue to Safety Check
          </button>
        </div>
      )}

      {/* Step 2: Safety questions */}
      {step === 2 && (
        <div className="card space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" /> Step 2: Safety Check
          </h2>

          <div className="space-y-4">
            <label className="flex items-center gap-4 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.sealIntact}
                onChange={(e) => setForm({ ...form, sealIntact: e.target.checked })}
                className="w-5 h-5 text-emerald-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Seal is intact</div>
                <div className="text-sm text-gray-500">The box has not been opened and the seal is unbroken</div>
              </div>
            </label>

            <label className="flex items-center gap-4 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.storageVerified}
                onChange={(e) => setForm({ ...form, storageVerified: e.target.checked })}
                className="w-5 h-5 text-emerald-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Stored correctly</div>
                <div className="text-sm text-gray-500">If refrigeration was required, it was maintained at all times</div>
              </div>
            </label>
          </div>

          {form.scannedText && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase mb-1">
                OCR Result (Confidence: {Math.round(form.ocrConfidence * 100)}%)
              </p>
              <p className="text-sm text-blue-900 font-mono">{form.scannedText}</p>
            </div>
          )}

          {visionResult && (
            <div
              className={`rounded-xl p-4 border ${
                visionResult.damaged || visionResult.tampered
                  ? 'bg-red-50 border-red-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase mb-2 ${
                  visionResult.damaged || visionResult.tampered ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                AI Vision Check (Confidence: {Math.round((visionResult.confidence || 0) * 100)}%)
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  Seal intact: <span className="font-semibold">{visionResult.sealIntact ? 'Yes' : 'No / Unclear'}</span>
                </div>
                <div>
                  Damaged: <span className="font-semibold">{visionResult.damaged ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  Tampered: <span className="font-semibold">{visionResult.tampered ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  Label readable: <span className="font-semibold">{visionResult.labelReadable ? 'Yes' : 'No'}</span>
                </div>
              </div>
              {visionResult.flags?.length > 0 && (
                <ul className="mt-2 text-sm list-disc list-inside text-red-700">
                  {visionResult.flags.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">
              Back
            </button>
            <button onClick={() => goToStep(3)} className="btn-primary flex-1">
              Continue to Drop-off
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Select collection center */}
      {step === 3 && (
        <div className="card space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" /> Step 3: Select Drop-off Center
          </h2>

          {centers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Loading centers...</div>
          ) : (
            <div className="space-y-3">
              {centers.map((center) => (
                <label
                  key={center.id}
                  className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    form.centerId === center.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="centerId"
                    value={center.id}
                    checked={form.centerId === center.id}
                    onChange={(e) => setForm({ ...form, centerId: e.target.value })}
                    className="w-5 h-5 text-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{center.name}</div>
                    <div className="text-sm text-gray-500">
                      {center.address}, {center.city}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {center.type} · Open {center.openTime}–{center.closeTime}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1">
              Back
            </button>
            <button onClick={handleSubmit} className="btn-primary flex-1" disabled={loading || !form.centerId}>
              {loading ? 'Submitting...' : 'Submit Donation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
