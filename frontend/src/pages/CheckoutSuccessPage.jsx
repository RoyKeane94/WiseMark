import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../lib/api';
import useAuthStore from '../stores/authStore';
import AuthLayout from '../components/AuthLayout';

export default function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [missingSession, setMissingSession] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      setMissingSession(true);
      setVerifying(false);
      return;
    }
    authAPI.verifyCheckout(sessionId)
      .then(({ data }) => setEmail(data.email || ''))
      .catch((err) => {
        const msg = err.response?.data?.detail;
        if (msg && !msg.includes('already')) setError(msg);
      })
      .finally(() => setVerifying(false));
  }, [searchParams]);

  useEffect(() => {
    if (!verifying && !error && email) inputRefs.current[0]?.focus();
  }, [verifying, error, email]);

  const submitCode = async (digits) => {
    if (!email) return;
    setCodeError('');
    setCodeLoading(true);
    try {
      const { data } = await authAPI.verifyCode(email, digits.join(''));
      setToken(data.token);
      navigate('/app', { replace: true });
    } catch (err) {
      setCodeError(err.response?.data?.detail || 'Invalid code');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setCodeLoading(false);
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
      <div className="text-center">
        {verifying ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#2d3a52]/30 border-t-[#2d3a52] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <>
            <h1 className="text-[26px] font-normal text-[#1a1f2e] mb-2" style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}>
              Something went wrong
            </h1>
            <p className="text-sm text-[#8a96ae] font-light leading-relaxed mb-8">
              {error}
            </p>
          </>
        ) : missingSession ? (
          <>
            <h1 className="text-[26px] font-normal text-[#1a1f2e] mb-2" style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}>
              Complete sign-in
            </h1>
            <p className="text-sm text-[#8a96ae] font-light leading-relaxed mb-8">
              Open this page from the link after checkout, or sign in with the email you used to pay.
            </p>
            <Link
              to="/login"
              className="inline-block w-full py-3.5 text-[15px] font-medium text-white rounded-[7px] no-underline text-center transition-all duration-150"
              style={{ background: '#2d3a52' }}
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-[#f0faf5] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <polyline points="18 6 9 16 4 11" stroke="#2e7d52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-[26px] font-normal text-[#1a1f2e] mb-2" style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}>
              Payment successful
            </h1>
            <p className="text-sm text-[#8a96ae] font-light leading-relaxed mb-6">
              We&apos;ve sent a login code to{' '}
              {email
                ? <strong className="text-[#2d3a52] font-medium">{email}</strong>
                : 'your email'
              }.<br />
              Enter the code below to continue.
            </p>

            {codeError && (
              <div className="text-[13px] text-[#c0392b] mb-4 text-left">
                {codeError}
              </div>
            )}

            <div className="flex flex-col gap-4 text-left">
              <label className="block">
                <span className="block text-xs font-medium text-[#4a5568] uppercase tracking-wider mb-2">Login code</span>
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
                    disabled={codeLoading}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-11 h-[52px] text-center text-xl font-semibold border border-[#e2e6ef] rounded-[7px] text-[#1a1f2e] bg-[#f8f9fc] focus:border-[#2d3a52] focus:bg-white focus:shadow-[0_0_0_3px_rgba(45,58,82,0.08)] focus:outline-none transition-all disabled:opacity-50"
                    style={{ caretColor: 'transparent' }}
                  />
                ))}
              </div>
            </div>

            <p className="mt-6 text-sm text-[#8a96ae]">
              Wrong email or need a new code?{' '}
              <Link to="/login" className="text-[#2d3a52] font-medium no-underline border-b border-transparent hover:border-[#2d3a52] transition-[border-color]">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
