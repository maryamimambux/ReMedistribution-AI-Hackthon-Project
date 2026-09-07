import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { User, Mail, Phone, MapPin, Lock, Save, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '', centerId: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    fetchProfile();
    api.get('/centers')
      .then((res) => setCenters(res.data.data.filter((c) => c.isActive)))
      .catch(() => setCenters([]));
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/profile');
      setProfile(res.data.data);
      setForm({
        name: res.data.data.name || '',
        phone: res.data.data.phone || '',
        address: res.data.data.address || '',
        city: res.data.data.city || '',
        centerId: res.data.data.centerId || '',
      });
    } catch (err) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', form);
      toast.success('Profile updated');
      setProfile(res.data.data);
      updateUser?.(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
      setShowPasswordSection(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed');
    }
  };

  const handleResendVerification = async () => {
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent!');
    } catch (err) {
      toast.error('Failed to send verification email');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Settings</h1>
      <p className="text-gray-500 mb-8">Manage your account information</p>

      {/* Email verification banner */}
      {profile && !profile.emailVerified && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">Email not verified</p>
            <p className="text-xs text-yellow-600">Verify your email to unlock all features.</p>
          </div>
          <button onClick={handleResendVerification} className="text-xs font-medium text-yellow-700 hover:text-yellow-900 bg-yellow-100 px-3 py-1.5 rounded-lg">
            Resend Code
          </button>
        </div>
      )}

      {profile && profile.emailVerified && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">Email verified</p>
        </div>
      )}

      {/* Profile form */}
      <form onSubmit={handleSave} className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-600" /> Personal Information
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field w-full"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Mail className="w-4 h-4 inline mr-1" />Email
            </label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="input-field w-full bg-gray-50 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Phone className="w-4 h-4 inline mr-1" />Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field w-full"
              placeholder="+92 xxx xxxxxxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />City
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="input-field w-full"
              placeholder="e.g. Lahore"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input-field w-full"
              placeholder="Full address"
            />
          </div>
          {profile?.role === 'PHARMACIST' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-4 h-4 inline mr-1" />Hospital / Collection Center
              </label>
              <select
                value={form.centerId}
                onChange={(e) => setForm({ ...form, centerId: e.target.value })}
                className="input-field w-full"
              >
                <option value="">Select your center</option>
                {centers
                  .filter((c) => !form.city || c.city === form.city)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.city}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Donations and patient requests will be routed to this center.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            Role: <span className="font-medium text-gray-600">{profile?.role}</span> · Member since {new Date(profile?.createdAt).toLocaleDateString()}
          </div>
          <button type="submit" disabled={saving} className="btn-primary gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Password section */}
      {!showPasswordSection ? (
        <button
          onClick={() => setShowPasswordSection(true)}
          className="card w-full text-left flex items-center gap-3 hover:border-emerald-300 transition-colors"
        >
          <Lock className="w-5 h-5 text-gray-400" />
          <div>
            <p className="font-medium text-gray-900">Change Password</p>
            <p className="text-sm text-gray-500">Update your account password</p>
          </div>
        </button>
      ) : (
        <form onSubmit={handleChangePassword} className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-600" /> Change Password
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="input-field w-full"
                minLength={8}
                required
              />
              <p className="text-xs text-gray-400 mt-1">Min 8 characters, at least one letter and one number</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="submit" className="btn-primary">Update Password</button>
            <button type="button" onClick={() => setShowPasswordSection(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
