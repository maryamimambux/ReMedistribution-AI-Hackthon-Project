import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, Users, Heart, MapPin, AlertTriangle, TrendingUp, CheckCircle, Clock, Download, FileSpreadsheet, FileText, Search, MessageSquare, Building2, UserCircle, ClipboardList, LayoutDashboard, Inbox, Megaphone, Mail } from 'lucide-react';
import { exportCSV, exportCombinedCSV, exportPDF } from '../../utils/exportUtils';
import toast from 'react-hot-toast';

const COLORS = ['#059669', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'donations', label: 'Donations', icon: Heart },
  { id: 'requests', label: 'Patient Requests', icon: ClipboardList },
  { id: 'centers', label: 'Centers', icon: Building2 },
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'users', label: 'User Management', icon: UserCircle },
  { id: 'queries', label: 'Queries', icon: Inbox },
  { id: 'announce', label: 'Announce', icon: Megaphone },
  { id: 'export', label: 'Export Data', icon: Download },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Overview data
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [forecast, setForecast] = useState([]);

  // Detailed data
  const [donations, setDonations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [centers, setCenters] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [queries, setQueries] = useState([]);
  const [exportData, setExportData] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('active');

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchOverview();
    fetchDetailed();
  }, []);

  const fetchOverview = async () => {
    try {
      const [statsRes, overviewRes, forecastRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/dashboard/overview'),
        api.get('/ai/forecast', { params: { months: 6 } }).catch(() => ({ data: { data: { forecast: [] } } })),
      ]);
      setStats(statsRes.data.data);
      setOverview(overviewRes.data.data);
      setForecast(forecastRes.data?.data?.forecast || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDetailed = async () => {
    setLoading(true);
    try {
      const [donRes, reqRes, centerRes, userRes, queryRes, exportRes] = await Promise.all([
        api.get('/admin/donations', { params: { limit: 1000 } }),
        api.get('/admin/requests', { params: { limit: 1000 } }),
        api.get('/admin/centers', { params: { limit: 1000 } }),
        api.get('/admin/users', { params: { limit: 1000 } }),
        api.get('/queries', { params: { limit: 1000 } }),
        api.get('/admin/export'),
      ]);
      setDonations(donRes.data.data);
      setRequests(reqRes.data.data);
      setCenters(centerRes.data.data);
      setAllUsers(userRes.data.data);
      setQueries(queryRes.data.data);
      setExportData(exportRes.data.data);
    } catch (err) {
      toast.error('Failed to load admin data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = (type) => {
    if (!exportData) return toast.error('No data to export');

    if (type === 'all') {
      exportCombinedCSV('remedistribution_full_report', [
        {
          title: 'Users',
          data: exportData.users,
          headers: ['ID', 'Name', 'Email', 'Role', 'Phone', 'City', 'Active', 'Verified', 'Created'],
          keys: ['id', 'name', 'email', 'role', 'phone', 'city', 'isActive', 'emailVerified', 'createdAt'],
        },
        {
          title: 'Donations',
          data: exportData.donations,
          headers: ['Medicine', 'Category', 'Donor', 'Email', 'Center', 'City', 'Status', 'Qty', 'Date'],
          keys: ['medicine.name', 'medicine.category', 'donor.name', 'donor.email', 'center.name', 'center.city', 'status', 'quantity', 'createdAt'],
        },
        {
          title: 'Patient Requests',
          data: exportData.requests,
          headers: ['Patient', 'Email', 'Medicine', 'Qty', 'Urgency', 'Status', 'City', 'Date'],
          keys: ['patient.name', 'patient.email', 'medicineName', 'quantity', 'urgency', 'status', 'city', 'createdAt'],
        },
        {
          title: 'Centers',
          data: exportData.centers,
          headers: ['Name', 'City', 'Type', 'Phone', 'Email', 'Active', 'Created'],
          keys: ['name', 'city', 'type', 'phone', 'email', 'isActive', 'createdAt'],
        },
        {
          title: 'Inventory',
          data: exportData.inventory,
          headers: ['Medicine', 'Category', 'Center', 'City', 'Status', 'Qty', 'Expiry'],
          keys: ['medicine.name', 'medicine.category', 'center.name', 'center.city', 'status', 'quantity', 'expiryDate'],
        },
        {
          title: 'Queries',
          data: exportData.queries,
          headers: ['User', 'Email', 'Role', 'Subject', 'Status', 'Priority', 'Created'],
          keys: ['user.name', 'user.email', 'user.role', 'subject', 'status', 'priority', 'createdAt'],
        },
      ]);
      toast.success('Full report exported as CSV');
      return;
    }

    const map = {
      donations: ['donations_report', exportData.donations, ['Medicine', 'Category', 'Donor', 'Email', 'Center', 'City', 'Status', 'Qty', 'Date'], ['medicine.name', 'medicine.category', 'donor.name', 'donor.email', 'center.name', 'center.city', 'status', 'quantity', 'createdAt']],
      inventory: ['inventory_report', exportData.inventory, ['Medicine', 'Category', 'Center', 'City', 'Status', 'Qty', 'Expiry'], ['medicine.name', 'medicine.category', 'center.name', 'center.city', 'status', 'quantity', 'expiryDate']],
      requests: ['requests_report', exportData.requests, ['Patient', 'Email', 'Medicine', 'Qty', 'Urgency', 'Status', 'City', 'Date'], ['patient.name', 'patient.email', 'medicineName', 'quantity', 'urgency', 'status', 'city', 'createdAt']],
      users: ['users_report', exportData.users, ['Name', 'Email', 'Role', 'Phone', 'City', 'Active', 'Verified', 'Created'], ['name', 'email', 'role', 'phone', 'city', 'isActive', 'emailVerified', 'createdAt']],
      centers: ['centers_report', exportData.centers, ['Name', 'City', 'Type', 'Phone', 'Email', 'Active'], ['name', 'city', 'type', 'phone', 'email', 'isActive']],
      queries: ['queries_report', exportData.queries, ['User', 'Email', 'Role', 'Subject', 'Status', 'Priority', 'Created'], ['user.name', 'user.email', 'user.role', 'subject', 'status', 'priority', 'createdAt']],
    };

    const args = map[type];
    if (args) {
      exportCSV(...args);
      toast.success(`${type} exported as CSV`);
    }
  };

  const handleExportPDF = () => {
    if (!exportData || !stats) return toast.error('No data to export');

    const pdfStats = {
      'Total Donations': stats?.stats?.totalDonations || 0,
      'Pending Donations': stats?.stats?.pendingDonations || 0,
      'Total Requests': stats?.stats?.totalPatientRequests || 0,
      'Fulfilled': stats?.stats?.fulfilledRequests || 0,
      'Active Users': allUsers.filter((u) => u.isActive).length,
      'Pending Users': allUsers.filter((u) => u.isActive && !u.emailVerified).length,
      'Active Centers': stats?.stats?.totalCenters || 0,
      'Open Queries': queries.filter((q) => q.status === 'OPEN').length,
    };

    const tables = [
      {
        title: 'Recent Donations',
        headers: ['Medicine', 'Donor', 'Center', 'Status', 'Qty', 'Date'],
        rows: exportData.donations.slice(0, 15).map((d) => [
          d.medicine?.name || '—', d.donor?.name || '—', d.center?.name || '—',
          d.status, d.quantity, new Date(d.createdAt).toLocaleDateString(),
        ]),
      },
      {
        title: 'Recent Patient Requests',
        headers: ['Patient', 'Medicine', 'Qty', 'Urgency', 'Status', 'Date'],
        rows: exportData.requests.slice(0, 15).map((r) => [
          r.patient?.name || '—', r.medicineName || '—', r.quantity,
          r.urgency, r.status, new Date(r.createdAt).toLocaleDateString(),
        ]),
      },
      {
        title: 'Open Queries',
        headers: ['User', 'Role', 'Subject', 'Priority', 'Date'],
        rows: exportData.queries.filter((q) => q.status === 'OPEN').slice(0, 10).map((q) => [
          q.user?.name || '—', q.user?.role || '—', q.subject, q.priority,
          new Date(q.createdAt).toLocaleDateString(),
        ]),
      },
    ];

    exportPDF('Admin Dashboard Report', pdfStats, tables);
    toast.success('PDF report exported');
  };

  const aggregateForecast = (data) => {
    const byMonth = {};
    data.forEach((f) => {
      if (!byMonth[f.month]) byMonth[f.month] = { month: f.month, predicted: 0, requests: 0 };
      byMonth[f.month].predicted += Number(f.predicted) || 0;
      byMonth[f.month].requests += Number(f.requests) || 0;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  };

  const forecastData = useMemo(() => aggregateForecast(forecast), [forecast]);

  const filteredDonations = useMemo(() => {
    return donations.filter((d) => {
      const matchesSearch = !searchTerm ||
        d.medicine?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.donor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.donor?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [donations, searchTerm, statusFilter]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesSearch = !searchTerm ||
        r.medicineName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.patient?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.city?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || r.status === statusFilter;
      const matchesUrgency = !roleFilter || r.urgency === roleFilter;
      return matchesSearch && matchesStatus && matchesUrgency;
    });
  }, [requests, searchTerm, statusFilter, roleFilter]);

  const filteredCenters = useMemo(() => {
    return centers.filter((c) => {
      const matchesSearch = !searchTerm ||
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.address?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCity = !statusFilter || c.city === statusFilter;
      return matchesSearch && matchesCity;
    });
  }, [centers, searchTerm, statusFilter]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const matchesRole = !roleFilter || u.role === roleFilter;
      const matchesStatus = userStatusFilter === 'all' ? true :
        userStatusFilter === 'active' ? u.isActive && u.emailVerified :
        userStatusFilter === 'pending' ? u.isActive && !u.emailVerified :
        !u.isActive;
      const matchesSearch = !searchTerm ||
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.city?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [allUsers, roleFilter, userStatusFilter, searchTerm]);

  const pendingDonations = useMemo(() => donations.filter((d) => ['PENDING', 'SCANNED'].includes(d.status)), [donations]);
  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'PENDING'), [requests]);

  const toggleUserStatus = async (id, isActive) => {
    try {
      await api.patch(`/admin/users/${id}/status`, { isActive });
      toast.success(`User ${isActive ? 'activated' : 'deactivated'}`);
      fetchDetailed();
    } catch {
      toast.error('Action failed');
    }
  };

  const [replyQueryId, setReplyQueryId] = useState(null);
  const [replyText, setReplyText] = useState('');

  // Announcement / direct message state
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceMessage, setAnnounceMessage] = useState('');
  const [announceTarget, setAnnounceTarget] = useState('ALL');
  const [directUserId, setDirectUserId] = useState('');
  const [announceLink, setAnnounceLink] = useState('');
  const [sendingAnnounce, setSendingAnnounce] = useState(false);

  const submitReply = async (queryId) => {
    try {
      await api.patch(`/queries/${queryId}/reply`, { adminReply: replyText });
      toast.success('Reply sent');
      setReplyQueryId(null);
      setReplyText('');
      fetchDetailed();
    } catch {
      toast.error('Failed to send reply');
    }
  };

  const updateQueryStatus = async (id, status) => {
    try {
      await api.patch(`/queries/${id}/status`, { status });
      toast.success('Status updated');
      fetchDetailed();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const sendAnnouncement = async (e, isDirect = false) => {
    e.preventDefault();
    const title = announceTitle.trim();
    const message = announceMessage.trim();
    if (!title || !message) return toast.error('Title and message are required');

    setSendingAnnounce(true);
    try {
      const payload = {
        title,
        message,
        link: announceLink.trim() || undefined,
        ...(isDirect
          ? { userId: directUserId }
          : { targetRole: announceTarget }),
      };
      const res = await api.post('/admin/announce', payload);
      toast.success(res.data.message);
      setAnnounceTitle('');
      setAnnounceMessage('');
      setAnnounceLink('');
      setDirectUserId('');
      setAnnounceTarget('ALL');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSendingAnnounce(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Workspace and record management — {user?.name}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {stats?.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Heart, label: 'Total Donations', value: stats.stats.totalDonations, color: 'text-emerald-600' },
                { icon: Package, label: 'Available Inventory', value: stats.stats.totalInventory, color: 'text-blue-600' },
                { icon: Users, label: 'Patient Requests', value: stats.stats.totalPatientRequests, color: 'text-purple-600' },
                { icon: CheckCircle, label: 'Fulfillment Rate', value: `${stats.stats.fulfillmentRate}%`, color: 'text-green-600' },
                { icon: Clock, label: 'Pending Donations', value: stats.stats.pendingDonations, color: 'text-yellow-600' },
                { icon: AlertTriangle, label: 'Pending Requests', value: stats.stats.pendingRequests, color: 'text-red-600' },
                { icon: MapPin, label: 'Active Centers', value: stats.stats.totalCenters, color: 'text-teal-600' },
                { icon: TrendingUp, label: 'Total Matches', value: stats.stats.totalMatches, color: 'text-indigo-600' },
              ].map((metric, i) => (
                <div key={i} className="stat-card">
                  <metric.icon className={`w-6 h-6 ${metric.color} mb-2`} />
                  <div className="stat-value">{metric.value}</div>
                  <div className="stat-label">{metric.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {stats?.categoryBreakdown?.length > 0 && (
              <div className="card">
                <h2 className="font-bold text-gray-900 mb-4">Medicines by Category</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={stats.categoryBreakdown} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={90} label={({ category, count }) => `${category}: ${count}`}>
                      {stats.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {overview?.expiryRisk && (
              <div className="card">
                <h2 className="font-bold text-gray-900 mb-4">Expiry Risk Overview</h2>
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-red-500"></div><span className="font-medium">Critical (≤7 days)</span></div>
                    <span className="text-2xl font-bold text-red-600">{overview.expiryRisk.critical}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-yellow-500"></div><span className="font-medium">Warning (8-30 days)</span></div>
                    <span className="text-2xl font-bold text-yellow-600">{overview.expiryRisk.warning}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-emerald-500"></div><span className="font-medium">Safe</span></div>
                    <span className="text-2xl font-bold text-emerald-600">{overview.expiryRisk.total - overview.expiryRisk.critical - overview.expiryRisk.warning}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {forecastData.length > 0 ? (
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-600" /> Demand Forecast (Next 6 Months)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [value, 'Predicted Demand']} />
                  <Bar dataKey="predicted" fill="#059669" radius={[6, 6, 0, 0]} name="Predicted Demand" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="card text-center py-10 text-gray-500">No forecast data available. AI service may be offline.</div>
          )}
        </div>
      )}

      {/* DONATIONS TAB */}
      {activeTab === 'donations' && (
        <div className="card">
          <div className="flex flex-col md:flex-row gap-3 justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg">All Donations</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-9 pr-3 py-2 border rounded-lg text-sm" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">All Status</option>
                <option>PENDING</option><option>SCANNED</option><option>VERIFIED</option><option>APPROVED</option><option>REJECTED</option><option>MATCHED</option><option>DISPATCHED</option>
              </select>
            </div>
          </div>
          <DataTable
            headers={['Donor', 'Email', 'Phone', 'Medicine', 'Category', 'Batch', 'Qty', 'Center', 'City', 'Status', 'Date']}
            rows={filteredDonations.map((d) => [
              d.donor?.name || '—', d.donor?.email || '—', d.donor?.phone || '—',
              d.medicine?.name || '—', d.medicine?.category || '—', d.batchNumber || '—',
              d.quantity, d.center?.name || '—', d.center?.city || '—',
              <StatusBadge key={d.id} status={d.status} />,
              new Date(d.createdAt).toLocaleDateString(),
            ])}
            empty="No donations found"
          />
        </div>
      )}

      {/* REQUESTS TAB */}
      {activeTab === 'requests' && (
        <div className="card">
          <div className="flex flex-col md:flex-row gap-3 justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg">All Patient Requests</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-9 pr-3 py-2 border rounded-lg text-sm" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">All Status</option>
                <option>PENDING</option><option>MATCHED</option><option>FULFILLED</option><option>CANCELLED</option>
              </select>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">All Urgency</option>
                <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
              </select>
            </div>
          </div>
          <DataTable
            headers={['Patient', 'Email', 'Phone', 'City', 'Medicine', 'Qty', 'Urgency', 'Status', 'Description', 'Date']}
            rows={filteredRequests.map((r) => [
              r.patient?.name || '—', r.patient?.email || '—', r.patient?.phone || '—', r.patient?.city || '—',
              r.medicineName || '—', r.quantity,
              <StatusBadge key={r.id + 'u'} status={r.urgency} />,
              <StatusBadge key={r.id} status={r.status} />,
              <span key={r.id + 'd'} className="truncate max-w-xs block" title={r.description}>{r.description || '—'}</span>,
              new Date(r.createdAt).toLocaleDateString(),
            ])}
            empty="No requests found"
          />
        </div>
      )}

      {/* CENTERS TAB */}
      {activeTab === 'centers' && (
        <div className="card">
          <div className="flex flex-col md:flex-row gap-3 justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg">Active Collection Centers</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search centers..." className="pl-9 pr-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <DataTable
            headers={['Name', 'Type', 'City', 'Address', 'Phone', 'Email', 'Hours', 'Donations', 'Inventory', 'Active']}
            rows={filteredCenters.map((c) => [
              c.name, c.type, c.city, c.address, c.phone || '—', c.email || '—',
              `${c.openTime || '—'} - ${c.closeTime || '—'}`,
              c._count?.donations || 0, c._count?.inventoryItems || 0,
              c.isActive ? 'Yes' : 'No',
            ])}
            empty="No centers found"
          />
        </div>
      )}

      {/* PENDING TAB */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-bold text-gray-900 text-lg mb-4">Pending Donations ({pendingDonations.length})</h2>
            <DataTable
              headers={['Donor', 'Email', 'Medicine', 'Qty', 'Center', 'Status', 'Date']}
              rows={pendingDonations.map((d) => [
                d.donor?.name || '—', d.donor?.email || '—', d.medicine?.name || '—',
                d.quantity, d.center?.name || '—', <StatusBadge key={d.id} status={d.status} />,
                new Date(d.createdAt).toLocaleDateString(),
              ])}
              empty="No pending donations"
            />
          </div>
          <div className="card">
            <h2 className="font-bold text-gray-900 text-lg mb-4">Pending Patient Requests ({pendingRequests.length})</h2>
            <DataTable
              headers={['Patient', 'Email', 'Medicine', 'Qty', 'Urgency', 'City', 'Date']}
              rows={pendingRequests.map((r) => [
                r.patient?.name || '—', r.patient?.email || '—', r.medicineName || '—',
                r.quantity, <StatusBadge key={r.id + 'u'} status={r.urgency} />,
                r.city || '—', new Date(r.createdAt).toLocaleDateString(),
              ])}
              empty="No pending requests"
            />
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="flex flex-col md:flex-row gap-3 justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg">User Management</h2>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search users..." className="pl-9 pr-3 py-2 border rounded-lg text-sm" />
              </div>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">All Roles</option>
                <option>DONOR</option><option>PHARMACIST</option><option>PATIENT</option><option>ADMIN</option>
              </select>
              <select value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="active">Present (Active + Verified)</option>
                <option value="pending">Pending (Unverified)</option>
                <option value="inactive">Past (Inactive)</option>
                <option value="all">All Users</option>
              </select>
            </div>
          </div>
          <DataTable
            headers={['Name', 'Email', 'Role', 'Phone', 'City', 'Verified', 'Status', 'Donations', 'Requests', 'Queries', 'Actions']}
            rows={filteredUsers.map((u) => [
              u.name, u.email, u.role, u.phone || '—', u.city || '—',
              u.emailVerified ? 'Yes' : 'No',
              u.isActive ? 'Active' : 'Inactive',
              u._count?.donations || 0, u._count?.patientRequests || 0, u._count?.queries || 0,
              <button
                key={u.id}
                onClick={() => toggleUserStatus(u.id, !u.isActive)}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${u.isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
              >
                {u.isActive ? 'Deactivate' : 'Activate'}
              </button>,
            ])}
            empty="No users found"
          />
        </div>
      )}

      {/* QUERIES TAB */}
      {activeTab === 'queries' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
            <h2 className="font-bold text-gray-900 text-lg">Support Queries</h2>
            <div className="flex gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">All Status</option>
                <option>OPEN</option><option>IN_PROGRESS</option><option>RESOLVED</option><option>CLOSED</option>
              </select>
            </div>
          </div>
          {(statusFilter ? queries.filter((q) => q.status === statusFilter) : queries).map((q) => (
            <div key={q.id} className="card space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">{q.subject}</span>
                    <StatusBadge status={q.status} />
                    <StatusBadge status={q.priority} />
                  </div>
                  <p className="text-sm text-gray-500">
                    From: {q.user?.name} ({q.user?.role}) — {q.user?.email} — {q.user?.phone || 'no phone'}
                  </p>
                  <p className="text-sm text-gray-400">{new Date(q.createdAt).toLocaleString()}</p>
                </div>
                <select
                  value={q.status}
                  onChange={(e) => updateQueryStatus(q.id, e.target.value)}
                  className="border rounded-lg px-3 py-1 text-sm"
                >
                  <option>OPEN</option><option>IN_PROGRESS</option><option>RESOLVED</option><option>CLOSED</option>
                </select>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-700">{q.message}</p>
              </div>
              {q.adminReply && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-emerald-800 mb-1">Admin Reply ({new Date(q.repliedAt).toLocaleString()}):</p>
                  <p className="text-emerald-900">{q.adminReply}</p>
                </div>
              )}
              {replyQueryId === q.id ? (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    className="input-field w-full"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => submitReply(q.id)} className="btn-primary text-sm">Send Reply</button>
                    <button onClick={() => { setReplyQueryId(null); setReplyText(''); }} className="btn-secondary text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setReplyQueryId(q.id)} className="btn-secondary text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Reply
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ANNOUNCE TAB */}
      {activeTab === 'announce' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Megaphone className="w-5 h-5 text-emerald-600" /> Broadcast Announcement</h2>
            <p className="text-gray-500 text-sm mb-4">Send app updates, center news, or urgent notices to a group of users. They will receive a notification.</p>
            <form onSubmit={(e) => sendAnnouncement(e, false)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Group</label>
                <select value={announceTarget} onChange={(e) => setAnnounceTarget(e.target.value)} className="input-field w-full">
                  <option value="ALL">All Users</option>
                  <option value="DONOR">All Donors</option>
                  <option value="PATIENT">All Patients</option>
                  <option value="PHARMACIST">All Pharmacists</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} placeholder="e.g., New collection center in Lahore" className="input-field w-full" maxLength={200} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea value={announceMessage} onChange={(e) => setAnnounceMessage(e.target.value)} placeholder="Write the announcement..." className="input-field w-full" rows={4} maxLength={2000} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link (optional)</label>
                <input value={announceLink} onChange={(e) => setAnnounceLink(e.target.value)} placeholder="/centers or https://example.com" className="input-field w-full" maxLength={500} />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={sendingAnnounce} className="btn-primary flex items-center gap-2">
                  {sendingAnnounce ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Megaphone className="w-4 h-4" />}
                  Send Announcement
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Mail className="w-5 h-5 text-emerald-600" /> Direct Message</h2>
            <p className="text-gray-500 text-sm mb-4">Send a private message to a specific user. Useful for follow-ups or individual instructions.</p>
            <form onSubmit={(e) => sendAnnouncement(e, true)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
                <select value={directUserId} onChange={(e) => setDirectUserId(e.target.value)} className="input-field w-full" required>
                  <option value="">Choose a user...</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role}) — {u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} placeholder="e.g., Action required for your donation" className="input-field w-full" maxLength={200} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea value={announceMessage} onChange={(e) => setAnnounceMessage(e.target.value)} placeholder="Write the direct message..." className="input-field w-full" rows={4} maxLength={2000} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link (optional)</label>
                <input value={announceLink} onChange={(e) => setAnnounceLink(e.target.value)} placeholder="/my-donations or /dashboard" className="input-field w-full" maxLength={500} />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={sendingAnnounce} className="btn-primary flex items-center gap-2">
                  {sendingAnnounce ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPORT TAB */}
      {activeTab === 'export' && (
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Download className="w-5 h-5 text-emerald-600" /> Export Record Database</h2>
          <p className="text-gray-500 text-sm mb-6">Download complete records for admin record keeping. CSV exports include all fields; PDF includes summary + top records.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => handleExportCSV('donations')} disabled={exporting} className="btn-secondary gap-2 text-sm"><FileSpreadsheet className="w-4 h-4" /> Donations CSV</button>
            <button onClick={() => handleExportCSV('requests')} disabled={exporting} className="btn-secondary gap-2 text-sm"><FileSpreadsheet className="w-4 h-4" /> Requests CSV</button>
            <button onClick={() => handleExportCSV('users')} disabled={exporting} className="btn-secondary gap-2 text-sm"><FileSpreadsheet className="w-4 h-4" /> Users CSV</button>
            <button onClick={() => handleExportCSV('centers')} disabled={exporting} className="btn-secondary gap-2 text-sm"><FileSpreadsheet className="w-4 h-4" /> Centers CSV</button>
            <button onClick={() => handleExportCSV('inventory')} disabled={exporting} className="btn-secondary gap-2 text-sm"><FileSpreadsheet className="w-4 h-4" /> Inventory CSV</button>
            <button onClick={() => handleExportCSV('queries')} disabled={exporting} className="btn-secondary gap-2 text-sm"><FileSpreadsheet className="w-4 h-4" /> Queries CSV</button>
            <button onClick={() => handleExportCSV('all')} disabled={exporting} className="btn-primary gap-2 text-sm"><FileSpreadsheet className="w-4 h-4" /> Export All (Combined CSV)</button>
            <button onClick={handleExportPDF} disabled={exporting} className="btn-primary gap-2 text-sm"><FileText className="w-4 h-4" /> Export PDF Report</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────

function DataTable({ headers, rows, empty }) {
  if (rows.length === 0) {
    return <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl">{empty}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-100 text-gray-700 font-semibold">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 whitespace-nowrap text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    SCANNED: 'bg-blue-100 text-blue-700',
    VERIFIED: 'bg-indigo-100 text-indigo-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
    MATCHED: 'bg-purple-100 text-purple-700',
    DISPATCHED: 'bg-gray-100 text-gray-700',
    FULFILLED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-red-100 text-red-700',
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-700',
    OPEN: 'bg-yellow-100 text-yellow-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    RESOLVED: 'bg-emerald-100 text-emerald-700',
    CLOSED: 'bg-gray-100 text-gray-700',
    URGENT: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}
