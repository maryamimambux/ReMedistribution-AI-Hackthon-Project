import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="page-container max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
        <p className="text-gray-500 mb-6">
          If an account exists with <strong>{email}</strong>, we've sent a password reset link.
        </p>
        <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center justify-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container max-w-md mx-auto">
      <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Mail className="w-8 h-8 text-emerald-700" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Forgot Password?</h1>
      <p className="text-gray-500 text-center mb-8">Enter your email and we'll send you a reset link.</p>

      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field w-full mb-4"
          placeholder="your@email.com"
          required
          autoFocus
        />
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="text-center mt-6">
        <Link to="/login" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center justify-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>
      </p>
    </div>
  );
}
