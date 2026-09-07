import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { MessageSquare, Send, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function RequestMedicine() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState('form'); // 'form' or 'chat'
  const [loading, setLoading] = useState(false);

  // Form mode
  const [form, setForm] = useState({
    medicineName: '', urgency: 'MEDIUM', city: user?.city || '', location: '', description: '', quantity: 1,
  });

  // Prefill city from the patient's profile once it loads
  useEffect(() => {
    if (user?.city) {
      setForm((prev) => ({ ...prev, city: user.city }));
    }
  }, [user]);

  // Chat mode
  const [chatMessage, setChatMessage] = useState('');
  const [chatResult, setChatResult] = useState(null);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.medicineName) {
      toast.error('Please enter the medicine name');
      return;
    }
    setLoading(true);
    try {
      await api.post('/patients', form);
      toast.success('Request submitted! We will match you with available medicine.');
      navigate('/my-requests');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    setLoading(true);
    try {
      const res = await api.post('/patients/chat', { message: chatMessage });
      setChatResult(res.data.data);
      toast.success('Request created from chat!');
      setTimeout(() => navigate('/my-requests'), 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Chat failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Medicine</h1>
      <p className="text-gray-500 mb-8">Tell us what you need — choose form or chat mode</p>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setMode('form')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${mode === 'form' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <FileText className="w-4 h-4" /> Form
        </button>
        <button onClick={() => setMode('chat')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${mode === 'chat' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <MessageSquare className="w-4 h-4" /> AI Chat (Urdu/English)
        </button>
      </div>

      {mode === 'form' ? (
        <form onSubmit={handleFormSubmit} className="card space-y-5">
          <div>
            <label className="label">Medicine Name *</label>
            <input className="input-field" placeholder="e.g. Insulin, Glimepiride, Panadol" value={form.medicineName} onChange={(e) => setForm({ ...form, medicineName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Urgency</label>
              <select className="select-field" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                <option value="LOW">Low — Can wait</option>
                <option value="MEDIUM">Medium — Within a week</option>
                <option value="HIGH">High — Need soon</option>
                <option value="CRITICAL">Critical — Emergency</option>
              </select>
            </div>
            <div>
              <label className="label">Quantity</label>
              <input type="number" min="1" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div>
            <label className="label">City</label>
            <select className="select-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
              <option value="">Select city</option>
              <option>Karachi</option><option>Lahore</option><option>Islamabad</option>
              <option>Rawalpindi</option><option>Faisalabad</option><option>Peshawar</option>
            </select>
          </div>
          <div>
            <label className="label">Location / Area</label>
            <input
              className="input-field"
              placeholder="e.g. Gulberg III, near Main Boulevard"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-1">Helps us match you with the nearest collection center.</p>
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea className="input-field" rows={3} placeholder="Tell us more about your situation..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      ) : (
        <div className="card space-y-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-sm text-emerald-800">
              Describe your need in plain English or Urdu. Our AI will extract the medicine name, urgency, and location automatically.
            </p>
          </div>

          <form onSubmit={handleChatSubmit} className="flex gap-3">
            <input
              className="input-field flex-1"
              placeholder="e.g. Mujhe insulin ki zaroorat hai, meri ammi ko diabetes hai. Lahore mein hain."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
            />
            <button type="submit" className="btn-primary gap-2 px-6" disabled={loading || !chatMessage.trim()}>
              <Send className="w-5 h-5" /> {loading ? '...' : 'Send'}
            </button>
          </form>

          {chatResult && (
            <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">AI Parsed Result:</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Medicine:</span> <span className="font-semibold">{chatResult.parsed?.medicineName || 'N/A'}</span></div>
                <div><span className="text-gray-500">Urgency:</span> <span className="font-semibold">{chatResult.parsed?.urgency || 'N/A'}</span></div>
                <div><span className="text-gray-500">City:</span> <span className="font-semibold">{chatResult.parsed?.city || 'N/A'}</span></div>
                <div><span className="text-gray-500">Quantity:</span> <span className="font-semibold">{chatResult.parsed?.quantity || 1}</span></div>
              </div>
              <p className="text-xs text-gray-400">Request created successfully — check your requests for updates.</p>
            </div>
          )}

          {/* Example prompts */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Example prompts:</p>
            {[
              "I need insulin urgently, my father is diabetic. We are in Lahore.",
              "Mujhe Glimepiride chahiye, meri ammi ko diabetes hai. Karachi.",
              "Need Salbutamol inhaler for asthma. Can wait a few days. Islamabad.",
            ].map((example, i) => (
              <button
                key={i}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm text-gray-600 transition-colors"
                onClick={() => setChatMessage(example)}
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
