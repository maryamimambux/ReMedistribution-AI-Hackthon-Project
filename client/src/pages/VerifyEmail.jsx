import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Mail, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VerifyEmail() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef([]);

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputsRef.current[5]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/verify-email', { code: fullCode });
      updateUser({ emailVerified: true });
      toast.success('Email verified!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success('New code sent!');
      setCode(['', '', '', '', '', '']);
    } catch (err) {
      toast.error('Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="page-container max-w-md mx-auto text-center">
      <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Mail className="w-8 h-8 text-emerald-700" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
      <p className="text-gray-500 mb-8">
        We sent a 6-digit code to <strong>{user?.email}</strong>
      </p>

      <form onSubmit={handleVerify} className="mb-6">
        <div className="flex gap-2 justify-center mb-6">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
            />
          ))}
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full gap-2 disabled:opacity-50">
          {loading ? 'Verifying...' : 'Verify Email'} <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <p className="text-sm text-gray-500">
        Didn't receive the code?{' '}
        <button onClick={handleResend} disabled={resending} className="text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50">
          {resending ? 'Sending...' : 'Resend'}
        </button>
      </p>
    </div>
  );
}
