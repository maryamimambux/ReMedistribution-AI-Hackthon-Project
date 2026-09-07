import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ClipboardCheck, Package, AlertTriangle, CheckCircle, XCircle, Clock, Users, ArrowRight, Shield, Search } from 'lucide-react';

export default function PharmacistDashboard() {
  const { user } = useAuth();
  const [donations, setDonations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/donations', { params: { limit: 50 } }),
      api.get('/dashboard'),
    ])
      .then(([donRes, statsRes]) => {
        setDonations(donRes.data.data);
        setStats(statsRes.data.data.stats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pending = donations.filter((d) => ['SCANNED', 'PENDING'].includes(d.status));
  const recent = donations.filter((d) => d.status === 'APPROVED').slice(0, 5);

  const riskColors = { LOW: 'bg-emerald-100 text-emerald-800', MEDIUM: 'bg-yellow-100 text-yellow-800', HIGH: 'bg-red-100 text-red-800' };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacist Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome, {user?.name} — verify and manage donations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/patient-requests" className="btn-secondary gap-2"><Search className="w-5 h-5" /> Patient Requests</Link>
          <Link to="/inventory" className="btn-secondary gap-2"><Package className="w-5 h-5" /> Inventory</Link>
          <Link to="/pickup" className="btn-primary gap-2"><Shield className="w-5 h-5" /> Pickup Verification</Link>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-card">
            <Package className="w-6 h-6 text-blue-600 mb-2" />
            <div className="stat-value">{stats.totalDonations}</div>
            <div className="stat-label">Total Donations</div>
          </div>
          <div className="stat-card">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mb-2" />
            <div className="stat-value text-yellow-600">{stats.pendingDonations}</div>
            <div className="stat-label">Awaiting Verification</div>
          </div>
          <div className="stat-card">
            <CheckCircle className="w-6 h-6 text-green-600 mb-2" />
            <div className="stat-value text-green-600">{stats.totalInventory}</div>
            <div className="stat-label">Available in Inventory</div>
          </div>
          <Link to="/patient-requests" className="stat-card hover:border-emerald-400 transition-colors">
            <Users className="w-6 h-6 text-purple-600 mb-2" />
            <div className="stat-value text-purple-600">{stats.pendingRequests}</div>
            <div className="stat-label">Pending Patient Requests</div>
          </Link>
        </div>
      )}

      {/* Pending verification queue */}
      <h2 className="section-title flex items-center gap-2">
        <ClipboardCheck className="w-6 h-6 text-emerald-600" /> Verification Queue
      </h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : pending.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">All caught up!</h3>
          <p className="text-gray-500 mt-2">No donations pending verification.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {pending.map((d) => (
            <div key={d.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  d.aiRiskScore === 'HIGH' ? 'bg-red-100' : d.aiRiskScore === 'MEDIUM' ? 'bg-yellow-100' : 'bg-emerald-100'
                }`}>
                  <Package className={`w-6 h-6 ${
                    d.aiRiskScore === 'HIGH' ? 'text-red-700' : d.aiRiskScore === 'MEDIUM' ? 'text-yellow-700' : 'text-emerald-700'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{d.medicine?.name}</h3>
                    {d.aiRiskScore && <span className={`badge ${riskColors[d.aiRiskScore]}`}>Risk: {d.aiRiskScore}</span>}
                  </div>
                  <p className="text-sm text-gray-500">
                    {d.donor?.name} · Batch: {d.batchNumber || 'N/A'} · Qty: {d.quantity ?? 1}
                    {d.aiConfidence && ` · AI: ${Math.round(d.aiConfidence * 100)}%`}
                  </p>
                  {d.aiNotes && (
                    <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {d.aiNotes}
                    </p>
                  )}
                </div>
              </div>
              <Link to={`/verify/${d.id}`} className="btn-primary text-sm gap-1 py-2 px-4">
                Verify <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Recently verified */}
      {recent.length > 0 && (
        <>
          <h2 className="section-title">Recently Approved</h2>
          <div className="space-y-2">
            {recent.map((d) => (
              <div key={d.id} className="card flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <span className="font-medium text-gray-900">{d.medicine?.name}</span>
                    <span className="text-sm text-gray-500 ml-2">Batch: {d.batchNumber}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">{new Date(d.updatedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
