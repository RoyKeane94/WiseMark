import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { authAPI } from '../lib/api';
import AuthLayout from '../components/AuthLayout';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setToken = useAuthStore((s) => s.setToken);
  const [redirectMessage, setRedirectMessage] = useState(location.state?.message ?? '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === 'code') inputRefs.current[0]?.focus();
  }, [step]);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.requestCode(email, 'login');
      setStep('code');
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.email?.[0] || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (digits) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await authAPI.verifyCode(email, digits.join(''));
      setToken(data.token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid code');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (value && index === 5 && next.every((d) => d)) {
      submitCode(next);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      const digits = pasted.split('');
      setCode(digits);
      inputRefs.current[5]?.focus();
      submitCode(digits);
    }
  };

  return (
    <AuthLayout>
      <h1 className={`text-[26px] font-normal text-[#1a1f2e] ${step === 'code' ? 'mb-8' : 'mb-1.5'}`} style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}>
        Sign in
      </h1>
      {step === 'email' && (
        <p className="text-sm text-[#8a96ae] font-light mb-8 leading-relaxed">
          Enter your email and we'll send you a sign-in code.
        </p>
      )}

      {redirectMessage && step === 'email' && (
        <div className="text-center py-3 px-4 mb-6 rounded-[7px] text-sm text-[#2d3a52] bg-[#f0f4f8]">
          {redirectMessage}
        </div>
      )}

      {error && (
        <div className="text-[13px] text-[#c0392b] mb-4 min-h-[18px] transition-all duration-150 opacity-100 translate-y-0">
          {error}
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-[#4a5568] uppercase tracking-wider mb-2">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); setRedirectMessage(''); }}
              className={`w-full px-3.5 py-3 text-[15px] text-[#1a1f2e] bg-[#f8f9fc] border rounded-[7px] outline-none transition-all duration-150 ${
                error ? 'border-[#c0392b] shadow-[0_0_0_3px_rgba(192,57,43,0.07)]' : 'border-[#e2e6ef]'
              } focus:border-[#2d3a52] focus:bg-white focus:shadow-[0_0_0_3px_rgba(45,58,82,0.08)]`}
              placeholder="you@yourfirm.com"
              required
              autoComplete="email"
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 text-[15px] font-medium text-white rounded-[7px] border-none cursor-pointer transition-all duration-150 relative ${
              loading ? 'pointer-events-none' : ''
            }`}
            style={{ background: '#2d3a52' }}
          >
            <span className={loading ? 'opacity-0' : ''}>Continue</span>
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </span>
            )}
          </button>
        </form>
      )}

      {step === 'code' && (
        <>
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#f0faf5] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <polyline points="18 6 9 16 4 11" stroke="#2e7d52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-2xl font-normal text-[#1a1f2e] mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Check your inbox
            </h2>
            <p className="text-sm text-[#8a96ae] leading-relaxed">
              We sent a code to <strong className="text-[#2d3a52] font-medium">{email}</strong>.<br />
              It expires in 10 minutes.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-[#4a5568] uppercase tracking-wider mb-2">Verification code</span>
            </label>
            <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-11 h-[52px] text-center text-xl font-semibold border border-[#e2e6ef] rounded-[7px] text-[#1a1f2e] bg-[#f8f9fc] focus:border-[#2d3a52] focus:bg-white focus:shadow-[0_0_0_3px_rgba(45,58,82,0.08)] focus:outline-none transition-all"
                  style={{ caretColor: 'transparent' }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(['', '', '', '', '', '']); setError(''); }}
              className="text-sm text-[#8a96ae] hover:text-[#4a5568] transition-colors"
            >
              Use a different email
            </button>
          </div>
        </>
      )}

      <p className="mt-6 text-center text-sm text-[#8a96ae]">
        No account? <Link to="/register" className="text-[#2d3a52] font-medium no-underline border-b border-transparent hover:border-[#2d3a52] transition-[border-color]">Register</Link>
      </p>
    </AuthLayout>
  );
}
