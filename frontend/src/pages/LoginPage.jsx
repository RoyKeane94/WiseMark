import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { authAPI } from '../lib/api';
import { pageWrapper, text, bg, btnPrimary } from '../lib/theme';

export default function LoginPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
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
      await authAPI.requestCode(email);
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
    <div className={`${pageWrapper} ${bg.page} flex items-center justify-center`}>
      <div className="w-full max-w-sm">
        <h1 className={`text-2xl font-semibold ${text.heading} mb-1.5`}>Sign in</h1>
        <p className={`text-sm ${text.muted} mb-6`}>
          {step === 'email'
            ? 'Enter your email and we\'ll send you a code.'
            : `Enter the 6-digit code sent to ${email}`}
        </p>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {step === 'email' ? (
          <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className={`text-sm ${text.secondary}`}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                required
                autoComplete="email"
                autoFocus
              />
            </label>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'Sending code...' : 'Continue'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
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
                  className="w-11 h-13 text-center text-xl font-semibold border border-slate-200 rounded-lg text-slate-900 focus:border-slate-400 focus:outline-none transition-colors"
                  style={{ caretColor: 'transparent' }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(['', '', '', '', '', '']); setError(''); }}
              className={`text-sm ${text.muted} hover:${text.secondary} transition-colors`}
            >
              Use a different email
            </button>
          </div>
        )}

        <p className={`mt-5 text-sm ${text.muted}`}>
          No account? <Link to="/register" className="text-slate-700 underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
