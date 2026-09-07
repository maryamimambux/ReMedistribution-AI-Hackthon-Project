import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Inbox, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-700',
};

const PRIORITY_STYLES = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

export default function MyQueries() {
  const { user } = useAuth();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('MEDIUM');

  const fetchQueries = async () => {
    try {
      const res = await api.get('/queries/my');
      setQueries(res.data.data);
    } catch (err) {
      toast.error('Failed to load your queries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/queries', { subject, message, priority });
      toast.success('Query sent to admin');
      setSubject('');
      setMessage('');
      setPriority('MEDIUM');
      fetchQueries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send query');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-emerald-600" /> Support & Queries
        </h1>
        <p className="text-gray-500 mt-1">
          Reach out to the admin for help, report issues, or ask questions. Replies will appear here.
        </p>
      </div>

      {/* New Query Form */}
      <div className="card mb-8">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-600" /> Write a new query
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Problem with my donation"
                className="input-field w-full"
                maxLength={200}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input-field w-full"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question in detail..."
              className="input-field w-full"
              rows={4}
              maxLength={2000}
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Query
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Query History */}
      <div>
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-emerald-600" /> Your query history
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : queries.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium">No queries yet</p>
            <p className="text-sm mt-1">Use the form above to contact the admin.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queries.map((q) => (
              <div key={q.id} className="card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{q.subject}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Submitted {new Date(q.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_STYLES[q.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {q.priority}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[q.status] || 'bg-gray-100 text-gray-700'}`}>
                      {q.status}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-700 whitespace-pre-line">{q.message}</p>
                </div>

                {q.adminReply ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <p className="text-sm font-semibold text-emerald-800 mb-1 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Admin Reply
                      {q.repliedAt && (
                        <span className="text-emerald-600 font-normal">
                          · {new Date(q.repliedAt).toLocaleString()}
                        </span>
                      )}
                    </p>
                    <p className="text-emerald-900 whitespace-pre-line">{q.adminReply}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <AlertCircle className="w-4 h-4" />
                    Awaiting admin response. You will be notified when they reply.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
