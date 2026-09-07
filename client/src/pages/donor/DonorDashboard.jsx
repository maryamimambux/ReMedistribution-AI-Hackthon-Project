import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Package, Plus, Clock, CheckCircle, XCircle, Truck,
  Pencil, Trash2, X, Save,
} from 'lucide-react';
import SearchFilterBar from '../../components/SearchFilterBar';
import Pagination from '../../components/Pagination';

const statusConfig = {
  PENDING: { color: 'badge-yellow', icon: Clock, label: 'Pending' },
  SCANNED: { color: 'badge-blue', icon: Package, label: 'Scanned' },
  APPROVED: { color: 'badge-green', icon: CheckCircle, label: 'Approved' },
  REJECTED: { color: 'badge-red', icon: XCircle, label: 'Rejected' },
  MATCHED: { color: 'badge-green', icon: Truck, label: 'Matched' },
  DISPATCHED: { color: 'badge-gray', icon: Truck, label: 'Dispatched' },
};

const STATUS_OPTIONS = ['PENDING', 'SCANNED', 'APPROVED', 'REJECTED', 'MATCHED', 'DISPATCHED'];

export default function DonorDashboard() {
  const { user } = useAuth();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Edit modal state
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [centers, setCenters] = useState([]);

  useEffect(() => {
    fetchDonations();
  }, [page, search, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (editing) {
      api.get('/centers').then((res) => setCenters(res.data.data.filter((c) => c.isActive))).catch(() => setCenters([]));
    }
  }, [editing]);

  const fetchDonations = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (sortBy) params.sortBy = sortBy;
      params.sortOrder = sortOrder;

      const res = await api.get('/donations/my-donations', { params });
      setDonations(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotalItems(res.data.pagination?.total || res.data.data.length);
    } catch (err) {
      console.error('Failed to fetch donations:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: totalItems,
    approved: donations.filter((d) => d.status === 'APPROVED' || d.status === 'MATCHED').length,
    pending: donations.filter((d) => ['PENDING', 'SCANNED'].includes(d.status)).length,
    rejected: donations.filter((d) => d.status === 'REJECTED').length,
  };

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

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-gray-500 mt-1">Manage your medicine donations</p>
        </div>
        <Link to="/donate" className="btn-primary gap-2">
          <Plus className="w-5 h-5" /> Donate Medicine
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <Package className="w-6 h-6 text-emerald-600 mb-2" />
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Donations</div>
        </div>
        <div className="stat-card">
          <CheckCircle className="w-6 h-6 text-green-600 mb-2" />
          <div className="stat-value text-green-600">{stats.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <Clock className="w-6 h-6 text-yellow-600 mb-2" />
          <div className="stat-value text-yellow-600">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <XCircle className="w-6 h-6 text-red-500 mb-2" />
          <div className="stat-value text-red-500">{stats.rejected}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Recent Donations */}
      <h2 className="section-title">My Donations</h2>

      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by medicine name..."
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
          },
        ]}
        activeFilters={{ status: statusFilter }}
        onFilterChange={(key, value) => { if (key === 'status') { setStatusFilter(value); setPage(1); } }}
        sortOptions={[
          { value: 'createdAt', label: 'Date' },
          { value: 'status', label: 'Status' },
          { value: 'quantity', label: 'Quantity' },
        ]}
        sortValue={sortBy}
        onSortChange={(v) => { setSortBy(v || 'createdAt'); setPage(1); }}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : donations.length === 0 ? (
        <div className="card text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No donations found</h3>
          <p className="text-gray-500 mt-2">
            {search || statusFilter ? 'Try adjusting your filters' : 'Start by scanning and donating your first medicine.'}
          </p>
          {!search && !statusFilter && (
            <Link to="/donate" className="btn-primary mt-6 inline-flex gap-2">
              <Plus className="w-5 h-5" /> Make Your First Donation
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {donations.map((d) => {
            const config = statusConfig[d.status] || statusConfig.PENDING;
            return (
              <div key={d.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.medicine?.name || 'Unknown'}</h3>
                    <p className="text-sm text-gray-500">
                      {d.medicine?.category} {d.batchNumber && `· Batch: ${d.batchNumber}`} · Qty: {d.quantity ?? 1}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(d.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {d.center && ` · ${d.center.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={config.color}>{config.label}</span>
                  {d.aiRiskScore && (
                    <span className={`text-xs font-medium ${
                      d.aiRiskScore === 'LOW' ? 'risk-low' : d.aiRiskScore === 'MEDIUM' ? 'risk-medium' : 'risk-high'
                    }`}>
                      Risk: {d.aiRiskScore}
                    </span>
                  )}
                  {canEditDonation(d) && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => openEdit(d)}
                        className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Edit donation"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete donation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalItems}
      />
    </div>
  );
}
