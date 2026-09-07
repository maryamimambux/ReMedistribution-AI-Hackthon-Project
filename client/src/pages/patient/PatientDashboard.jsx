import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import PatientTabs from '../../components/PatientTabs';
import {
  Search, Plus, Clock, CheckCircle, Package, AlertTriangle,
  Pencil, Trash2, X, Save,
} from 'lucide-react';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, invRes] = await Promise.all([
        api.get('/patients/my-requests'),
        api.get('/inventory', { params: { limit: 10 } }),
      ]);
      setRequests(reqRes.data.data);
      setInventory(invRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const statusConfig = {
    PENDING: { color: 'badge-yellow', label: 'Searching' },
    MATCHED: { color: 'badge-green', label: 'Matched' },
    FULFILLED: { color: 'badge-gray', label: 'Collected' },
    CANCELLED: { color: 'badge-red', label: 'Cancelled' },
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
      fetchData();
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
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete request');
    }
  };

  return (
    <div className="page-container">
      <PatientTabs />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-gray-500 mt-1">Search for and track your medicine requests</p>
        </div>
        <Link to="/request-medicine" className="btn-primary gap-2">
          <Plus className="w-5 h-5" /> Request Medicine
        </Link>
      </div>

      {/* My requests */}
      <h2 className="section-title">My Requests</h2>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-12 mb-8">
          <Search className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No requests yet</h3>
          <p className="text-gray-500 mt-2">Tell us what medicine you need — in plain English or Urdu.</p>
          <Link to="/request-medicine" className="btn-primary mt-6">Make Your First Request</Link>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {requests.map((r) => {
            const config = statusConfig[r.status] || statusConfig.PENDING;
            return (
              <div key={r.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{r.medicineName}</h3>
                    <p className="text-sm text-gray-500">Qty: {r.quantity} · {r.city || r.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={config.color}>{config.label}</span>
                    <span className={`badge ${
                      r.urgency === 'CRITICAL' ? 'badge-red' : r.urgency === 'HIGH' ? 'badge-yellow' : 'badge-gray'
                    }`}>{r.urgency}</span>
                    {canEditRequest(r) && (
                      <div className="flex items-center gap-1 ml-1">
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
                {r.description && <p className="text-sm text-gray-600 mb-2">"{r.description}"</p>}
                {r.matches?.length > 0 && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Match Found!
                    </p>
                    {r.matches.map((m) => (
                      <p key={m.id} className="text-sm text-emerald-700 mt-1">
                        {m.inventoryItem?.medicine?.name} at {m.inventoryItem?.center?.name}, {m.inventoryItem?.center?.city}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">{new Date(r.createdAt).toLocaleDateString()}</p>
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

      {/* Available medicines */}
      <h2 className="section-title">Available Medicines</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {inventory.slice(0, 9).map((item) => (
          <div key={item.id} className="card">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{item.medicine?.name}</h3>
                <p className="text-xs text-gray-500">{item.medicine?.category} · {item.medicine?.dosage}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              <p>{item.center?.name}, {item.center?.city}</p>
              <p>Qty: {item.quantity}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
