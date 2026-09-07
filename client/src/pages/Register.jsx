import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Heart, Eye, EyeOff } from 'lucide-react';

const ROLES = [
  { value: 'DONOR', label: 'Donor', desc: 'I want to donate unused medicine' },
  { value: 'PATIENT', label: 'Patient', desc: 'I need medicine I cannot afford' },
  { value: 'PHARMACIST', label: 'Pharmacist/NGO', desc: 'I verify and manage donations' },
];

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'DONOR', phone: '', city: '', centerId: '',
  });
  const [centers, setCenters] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Load active collection centers so pharmacists can pick their hospital/center
  useEffect(() => {
    api.get('/centers')
      .then((res) => setCenters(res.data.data.filter((c) => c.isActive)))
      .catch(() => setCenters([]));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRoleChange = (role) => {
    setForm({ ...form, role, centerId: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // prevent double submit
    setLoading(true);
    try {
      const user = await register(form);
      toast.success(`Account created! Welcome, ${user.name}. Please verify your email.`);
      navigate('/verify-email');
    } catch (err) {
      let message = 'Registration failed';
      if (err.code === 'ERR_NETWORK' || !err.response) {
        message = 'Cannot connect to server. Please make sure the backend is running on port 5000.';
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      toast.error(message);
      // If rate limited, keep the button disabled briefly to stop rapid retries
      if (err.response?.status === 429) {
        setTimeout(() => setLoading(false), 1500);
        return;
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-2">Join the medicine redistribution network</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {/* Role selection */}
          <div>
            <label className="label">I am a...</label>
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => handleRoleChange(role.value)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    form.role === role.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="text-sm font-semibold">{role.label}</div>
                  <div className="text-[11px] mt-0.5 opacity-70">{role.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input name="name" className="input-field" placeholder="Ahmed Khan" value={form.name} onChange={handleChange} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input name="phone" className="input-field" placeholder="+92-300-1234567" value={form.phone} onChange={handleChange} />
            </div>
          </div>

          {form.role === 'PHARMACIST' && (
            <div>
              <label className="label">Hospital / Collection Center *</label>
              <select
                name="centerId"
                className="select-field"
                value={form.centerId}
                onChange={handleChange}
                required={form.role === 'PHARMACIST'}
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

          <div>
            <label className="label">Email *</label>
            <input name="email" type="email" className="input-field" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">City</label>
              <select name="city" className="select-field" value={form.city} onChange={handleChange}>
                <option value="">Select city</option>
                <option>Karachi</option>
                <option>Lahore</option>
                <option>Islamabad</option>
                <option>Rawalpindi</option>
                <option>Faisalabad</option>
                <option>Peshawar</option>
                <option>Multan</option>
                <option>Quetta</option>
              </select>
            </div>
            <div>
              <label className="label">Password *</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
