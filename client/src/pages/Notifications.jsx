import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Filter } from 'lucide-react';
import api from '../services/api';

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchNotifications();
  }, [filter, page]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filter === 'unread') params.unreadOnly = 'true';
      const res = await api.get('/notifications', { params });
      setNotifications(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      // silent
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const typeConfig = {
    DONATION_RECEIVED: { color: 'bg-blue-100 text-blue-700', label: 'Donation' },
    DONATION_APPROVED: { color: 'bg-green-100 text-green-700', label: 'Approved' },
    DONATION_REJECTED: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
    NEW_REQUEST: { color: 'bg-purple-100 text-purple-700', label: 'New Request' },
    MATCH_FOUND: { color: 'bg-emerald-100 text-emerald-700', label: 'Match' },
    PICKUP_READY: { color: 'bg-yellow-100 text-yellow-700', label: 'Pickup' },
    PICKUP_CONFIRMED: { color: 'bg-green-100 text-green-700', label: 'Picked Up' },
    DELIVERY_COMPLETE: { color: 'bg-emerald-100 text-emerald-700', label: 'Delivered' },
    EXPIRING_SOON: { color: 'bg-orange-100 text-orange-700', label: 'Expiry' },
    NEW_QUERY: { color: 'bg-purple-100 text-purple-700', label: 'Query' },
    QUERY_REPLIED: { color: 'bg-blue-100 text-blue-700', label: 'Reply' },
    ANNOUNCEMENT: { color: 'bg-purple-100 text-purple-700', label: 'Announcement' },
  };

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">Stay updated on your donations and requests</p>
          </div>
        </div>
        <button
          onClick={markAllRead}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
        >
          <CheckCheck className="w-4 h-4" /> Mark all read
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setFilter('all'); setPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => { setFilter('unread'); setPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'unread' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Unread
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card text-center py-16">
          <Bell className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No notifications</h3>
          <p className="text-gray-500 mt-2">You'll be notified when something important happens.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const config = typeConfig[n.type] || { color: 'bg-gray-100 text-gray-600', label: 'Info' };
            return (
              <div
                key={n.id}
                className={`card flex items-start gap-4 transition-colors cursor-pointer ${
                  !n.isRead ? 'bg-emerald-50/50 border-emerald-200' : ''
                }`}
                onClick={() => {
                  if (!n.isRead) markAsRead(n.id);
                  if (n.link) navigate(n.link);
                }}
              >
                <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-emerald-500' : 'bg-transparent'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                  </div>
                  <h4 className={`text-sm ${!n.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                    {n.title}
                  </h4>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
