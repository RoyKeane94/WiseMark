import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { authAPI } from '../lib/api';
import AuthLayout from '../components/AuthLayout';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState('');
  const [signUpCode, setSignUpCode] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('email');
  const [error, setError] = useState('');
  const [signUpCodeError, setSignUpCodeError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === 'code') inputRefs.current[0]?.focus();
  }, [step]);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSignUpCodeError('');

    const emailVal = email.trim();
    const codeVal = signUpCode.trim();
    if (!emailVal) {
      setError('Please enter your email address.');
      return;
    }
    if (!codeVal) {
      setSignUpCodeError('Please enter your sign up code.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.requestCode(emailVal, 'register', { beta_code: codeVal });
      setStep('code');
    } catch (err) {
      const data = err.response?.data;
      if (data?.redirect === '/login' || (data?.detail && data.detail.includes('already exists'))) {
        navigate('/login', { replace: true, state: { message: 'You already have an account. Please sign in.' } });
        return;
      }
      const msg = data?.detail || data?.beta_code?.[0] || data?.email?.[0] || 'Failed to send code';
      if (data?.beta_code?.[0] || (data?.detail && (data.detail.toLowerCase().includes('sign up code') || data.detail.toLowerCase().includes('code')))) {
        setSignUpCodeError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStripeCheckout = async () => {
    const emailVal = email.trim();
    if (!emailVal) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    setCheckoutLoading(true);
    try {
      const { data } = await authAPI.createCheckoutSession(emailVal);
      window.location.href = data.checkout_url;
    } catch (err) {
      const data = err.response?.data;
      if (data?.redirect === '/login') {
        navigate('/login', { replace: true, state: { message: 'You already have an account. Please sign in.' } });
        return;
      }
      setError(data?.detail || 'Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const submitCode = async (digits) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await authAPI.verifyCode(email, digits.join(''), { beta_code: signUpCode.trim() });
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
        Create account
      </h1>
      {step === 'email' && (
        <p className="text-sm text-[#8a96ae] font-light mb-8 leading-relaxed">
          Enter your email to get started.
        </p>
      )}

      {error && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-3 mb-4 rounded-[7px] border transition-all duration-150"
          style={{
            backgroundColor: '#fef2f2',
            borderColor: '#fecaca',
            color: '#b91c1c',
          }}
        >
          <AlertCircle className="shrink-0 w-4 h-4" style={{ color: '#b91c1c' }} />
          <span className="text-[13px] font-medium">{error}</span>
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleRequestCode} noValidate className="flex flex-col gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-[#4a5568] uppercase tracking-wider mb-2">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className={`w-full px-3.5 py-3 text-[15px] text-[#1a1f2e] bg-[#f8f9fc] border rounded-[7px] outline-none transition-all duration-150 ${
                error ? 'border-[#c0392b] shadow-[0_0_0_3px_rgba(192,57,43,0.07)]' : 'border-[#e2e6ef]'
              } focus:border-[#2d3a52] focus:bg-white focus:shadow-[0_0_0_3px_rgba(45,58,82,0.08)]`}
              placeholder="you@yourfirm.com"
              autoComplete="email"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-[#4a5568] uppercase tracking-wider mb-2">Sign up code</span>
            <input
              type="text"
              value={signUpCode}
              onChange={(e) => { setSignUpCode(e.target.value); setSignUpCodeError(''); setError(''); }}
              className={`w-full px-3.5 py-3 text-[15px] text-[#1a1f2e] bg-[#f8f9fc] border rounded-[7px] outline-none transition-all duration-150 ${
                signUpCodeError ? 'border-[#c0392b] shadow-[0_0_0_3px_rgba(192,57,43,0.07)]' : 'border-[#e2e6ef]'
              } focus:border-[#2d3a52] focus:bg-white focus:shadow-[0_0_0_3px_rgba(45,58,82,0.08)]`}
              placeholder="Enter if you have a sign up code"
              autoComplete="off"
              aria-invalid={!!signUpCodeError}
              aria-describedby={signUpCodeError ? 'signup-code-error' : undefined}
            />
            {signUpCodeError && (
              <div
                id="signup-code-error"
                role="alert"
                className="flex items-center gap-2.5 px-3.5 py-2.5 mt-2 rounded-[7px] border transition-all duration-150"
                style={{
                  backgroundColor: '#fef2f2',
                  borderColor: '#fecaca',
                  color: '#b91c1c',
                }}
              >
                <AlertCircle className="shrink-0 w-4 h-4" style={{ color: '#b91c1c' }} />
                <span className="text-[13px] font-medium">{signUpCodeError}</span>
              </div>
            )}
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
          <div className="relative flex items-center justify-center my-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e2e6ef]" /></div>
            <span className="relative bg-white px-3 text-xs text-[#8a96ae]">or</span>
          </div>
          <button
            type="button"
            onClick={handleStripeCheckout}
            disabled={checkoutLoading}
            className={`w-full py-3.5 text-[15px] font-medium rounded-[7px] border border-[#e2e6ef] cursor-pointer transition-all duration-150 relative bg-white text-[#2d3a52] hover:bg-[#f8f9fc] ${
              checkoutLoading ? 'pointer-events-none' : ''
            }`}
          >
            <span className={checkoutLoading ? 'opacity-0' : ''}>Don&apos;t have a code? Subscribe</span>
            {checkoutLoading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <div className="w-[18px] h-[18px] border-2 border-[#2d3a52]/30 border-t-[#2d3a52] rounded-full animate-spin" />
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
        Already have an account? <Link to="/login" className="text-[#2d3a52] font-medium no-underline border-b border-transparent hover:border-[#2d3a52] transition-[border-color]">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
