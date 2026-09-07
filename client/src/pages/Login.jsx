import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Heart, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // prevent double submit
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(user.emailVerified ? '/dashboard' : '/verify-email');
    } catch (err) {
      let message = 'Login failed';
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
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 mt-2">Sign in to your ReMedistribution account</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-12"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-emerald-600 hover:underline">
              Forgot password?
            </Link>
            <span className="text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-emerald-600 font-semibold hover:underline">
                Create account
              </Link>
            </span>
          </div>
        </form>

        {/* Demo accounts */}
        <div className="mt-6 card bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Demo Accounts</p>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Donor</span>
              <span className="font-mono">ahmed.donor@example.com</span>
            </div>
            <div className="flex justify-between">
              <span>Pharmacist</span>
              <span className="font-mono">fatima.pharmacist@example.com</span>
            </div>
            <div className="flex justify-between">
              <span>Patient</span>
              <span className="font-mono">ali.patient@example.com</span>
            </div>
            <p className="text-gray-400 text-center mt-2">Password: password123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
