import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { Package, AlertTriangle, Calendar } from 'lucide-react';
import SearchFilterBar from '../../components/SearchFilterBar';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [riskItems, setRiskItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('inventory');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/inventory'),
      api.get('/inventory/expiry-risk'),
    ])
      .then(([invRes, riskRes]) => {
        setItems(invRes.data.data);
        setRiskItems(riskRes.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const riskColors = { LOW: 'bg-emerald-100 text-emerald-800', MEDIUM: 'bg-yellow-100 text-yellow-800', HIGH: 'bg-red-100 text-red-800', CRITICAL: 'bg-red-200 text-red-900' };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedSearch) return items;
    return items.filter((item) =>
      item.medicine?.name?.toLowerCase().includes(normalizedSearch)
    );
  }, [items, normalizedSearch]);

  const filteredRiskItems = useMemo(() => {
    if (!normalizedSearch) return riskItems;
    return riskItems.filter((item) =>
      item.medicine?.name?.toLowerCase().includes(normalizedSearch)
    );
  }, [riskItems, normalizedSearch]);

  return (
    <div className="page-container">
      <h1 className="section-title">Inventory & Expiry Risk</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('inventory')} className={`px-4 py-2 rounded-lg font-medium text-sm transition ${tab === 'inventory' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Available Inventory ({items.length})
        </button>
        <button onClick={() => setTab('risk')} className={`px-4 py-2 rounded-lg font-medium text-sm transition ${tab === 'risk' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Expiry Risk Triage ({riskItems.length})
        </button>
      </div>

      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by medicine name..."
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : tab === 'inventory' ? (
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="card text-center py-12">
              <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500">
                {normalizedSearch ? 'No medicines match your search' : 'No inventory available'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.medicine?.name}</h3>
                    <p className="text-sm text-gray-500">
                      {item.medicine?.category} · Qty: {item.quantity}
                      {item.batchNumber && ` · Batch: ${item.batchNumber}`}
                    </p>
                    <p className="text-xs text-gray-400">{item.center?.name}, {item.center?.city}</p>
                  </div>
                </div>
                <div className="text-right">
                  {item.expiryDate && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {new Date(item.expiryDate).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  <span className="badge-green">{item.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRiskItems.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">
                {normalizedSearch ? 'No medicines match your search' : 'No expiry risk items'}
              </p>
            </div>
          ) : (
            filteredRiskItems.slice(0, 20).map((item) => (
              <div key={item.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    item.riskLevel === 'CRITICAL' || item.riskLevel === 'HIGH' ? 'bg-red-100' : item.riskLevel === 'MEDIUM' ? 'bg-yellow-100' : 'bg-emerald-100'
                  }`}>
                    <AlertTriangle className={`w-6 h-6 ${
                      item.riskLevel === 'CRITICAL' || item.riskLevel === 'HIGH' ? 'text-red-700' : item.riskLevel === 'MEDIUM' ? 'text-yellow-700' : 'text-emerald-700'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.medicine?.name}</h3>
                    <p className="text-sm text-gray-500">
                      {item.daysUntilExpiry > 0 ? `${item.daysUntilExpiry} days until expiry` : 'EXPIRED'} · {item.center?.city}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">{item.riskScore}</span>
                  <span className={`badge ${riskColors[item.riskLevel]}`}>{item.riskLevel}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
