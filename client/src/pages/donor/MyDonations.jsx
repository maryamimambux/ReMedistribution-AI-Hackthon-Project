import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Package, Plus, Pencil, Trash2, X, Save } from 'lucide-react';

export default function MyDonations() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [centers, setCenters] = useState([]);

  const fetchDonations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/donations/my-donations');
      setDonations(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, []);

  useEffect(() => {
    if (editing) {
      api.get('/centers').then((res) => setCenters(res.data.data.filter((c) => c.isActive))).catch(() => setCenters([]));
    }
  }, [editing]);

  const canEditDonation = (d) => ['PENDING', 'SCANNED'].includes(d.status);

  const openEdit = (d) => {
    setEditing(d);
    setEditForm({
      medicineName: d.medicine?.name || '',
      category: d.medicine?.category || '',
      manufacturer: d.medicine?.manufacturer || '',
      dosage: d.medicine?.dosage || '',
      form: d.medicine?.form || '',
      batchNumber: d.batchNumber || '',
      expiryDate: d.expiryDate ? new Date(d.expiryDate).toISOString().split('T')[0] : '',
      quantity: d.quantity || 1,
      sealIntact: d.sealIntact ?? true,
      storageVerified: d.storageVerified ?? false,
      centerId: d.centerId || '',
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editForm.medicineName) {
      toast.error('Medicine name is required');
      return;
    }
    setEditLoading(true);
    try {
      await api.patch(`/donations/${editing.id}`, editForm);
      toast.success('Donation updated');
      closeEdit();
      fetchDonations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update donation');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this donation?')) return;
    try {
      await api.delete(`/donations/${id}`);
      toast.success('Donation deleted');
      fetchDonations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete donation');
    }
  };

  const statusColors = {
    PENDING: 'badge-yellow', SCANNED: 'badge-blue', APPROVED: 'badge-green',
    REJECTED: 'badge-red', MATCHED: 'badge-green', DISPATCHED: 'badge-gray',
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <h1 className="section-title mb-0">My Donations</h1>
        <Link to="/donate" className="btn-primary gap-2"><Plus className="w-5 h-5" /> New Donation</Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : donations.length === 0 ? (
        <div className="card text-center py-16">
          <Package className="w-20 h-20 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">No donations yet</h3>
          <p className="text-gray-500 mt-2">Your donated medicines will appear here.</p>
          <Link to="/donate" className="btn-primary mt-6">Start Donating</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {donations.map((d) => (
            <div key={d.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{d.medicine?.name}</h3>
                  <p className="text-sm text-gray-500">{d.medicine?.category}</p>
                </div>
                <span className={statusColors[d.status] || 'badge-gray'}>{d.status}</span>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {d.batchNumber && <p>Batch: {d.batchNumber}</p>}
                <p>Quantity: {d.quantity ?? 1}</p>
                {d.expiryDate && <p>Expires: {new Date(d.expiryDate).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' })}</p>}
                {d.center && <p>Center: {d.center.name}</p>}
                {d.aiRiskScore && (
                  <p className={d.aiRiskScore === 'LOW' ? 'risk-low' : d.aiRiskScore === 'MEDIUM' ? 'risk-medium' : 'risk-high'}>
                    AI Risk: {d.aiRiskScore} ({d.aiConfidence && `${Math.round(d.aiConfidence * 100)}% confidence`})
                  </p>
                )}
              </div>
              {canEditDonation(d) && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => openEdit(d)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3">
                {new Date(d.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Edit Donation Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Edit Donation</h3>
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
                  <label className="label">Category</label>
                  <input name="category" className="input-field" value={editForm.category} onChange={handleEditChange} />
                </div>
                <div>
                  <label className="label">Manufacturer</label>
                  <input name="manufacturer" className="input-field" value={editForm.manufacturer} onChange={handleEditChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Dosage</label>
                  <input name="dosage" className="input-field" value={editForm.dosage} onChange={handleEditChange} />
                </div>
                <div>
                  <label className="label">Form</label>
                  <input name="form" className="input-field" value={editForm.form} onChange={handleEditChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Batch Number</label>
                  <input name="batchNumber" className="input-field" value={editForm.batchNumber} onChange={handleEditChange} />
                </div>
                <div>
                  <label className="label">Expiry Date</label>
                  <input type="date" name="expiryDate" className="input-field" value={editForm.expiryDate} onChange={handleEditChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" name="quantity" min="1" className="input-field" value={editForm.quantity} onChange={handleEditChange} />
                </div>
                <div>
                  <label className="label">Collection Center</label>
                  <select name="centerId" className="select-field" value={editForm.centerId} onChange={handleEditChange}>
                    <option value="">Select center</option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} — {c.city}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="sealIntact" checked={editForm.sealIntact} onChange={handleEditChange} className="w-4 h-4 text-emerald-600 rounded" />
                  Seal intact
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="storageVerified" checked={editForm.storageVerified} onChange={handleEditChange} className="w-4 h-4 text-emerald-600 rounded" />
                  Storage verified
                </label>
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
