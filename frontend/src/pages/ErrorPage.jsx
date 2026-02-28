import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { authAPI } from '../lib/api';

function generateErrorCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function ErrorPage({ onRetry, error }) {
  const referenceCode = useMemo(() => generateErrorCode(), []);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    const errorDetail = error ? `${error.toString()}\n${error?.stack || ''}`.slice(0, 2000) : undefined;
    try {
      await authAPI.reportError({
        reference_code: referenceCode,
        message: [message.trim(), errorDetail].filter(Boolean).join('\n\n') || undefined,
        email: email.trim() || undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-[26px] font-normal text-[#1a1f2e] mb-2" style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}>
        Something went wrong
      </h1>
      <p className="text-sm text-[#8a96ae] font-light mb-2 leading-relaxed">
        We're sorry, something unexpected happened. Please quote your reference code when contacting us.
      </p>
      <p className="text-xs font-medium text-[#4a5568] uppercase tracking-wider mb-1">Your reference code</p>
      <div className="font-mono text-[15px] font-semibold text-[#1a1f2e] tracking-wide bg-[#f1f5f9] rounded-lg py-2 px-3 inline-block mb-4">
        {referenceCode}
      </div>
      <p className="text-sm text-[#8a96ae] font-light mb-6 leading-relaxed">
        Email <a href="mailto:support@wisemarkhq.com" className="text-[#2d3a52] font-medium">support@wisemarkhq.com</a> with this code, or submit the form below.
      </p>

      {!submitted ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-6">
          <label className="block">
            <span className="block text-xs font-medium text-[#4a5568] uppercase tracking-wider mb-1.5">What were you doing? (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#e2e6ef] rounded-[7px] resize-y min-h-[80px] focus:border-[#2d3a52] focus:outline-none"
              placeholder="Brief description…"
              rows={3}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-[#4a5568] uppercase tracking-wider mb-1.5">Your email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#e2e6ef] rounded-[7px] focus:border-[#2d3a52] focus:outline-none"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={sending}
            className="w-full py-3.5 text-[15px] font-medium text-white rounded-[7px] border-none cursor-pointer disabled:opacity-70"
            style={{ background: '#2d3a52' }}
          >
            {sending ? 'Sending…' : 'Send report'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[#2e7d52] mb-6">Thanks — we've received your report.</p>
      )}

      <div className="flex flex-col gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full py-3.5 text-[15px] font-medium text-white rounded-[7px] border-none cursor-pointer hover:opacity-90"
            style={{ background: '#2d3a52' }}
          >
            Try again
          </button>
        )}
        <Link
          to="/"
          className="inline-block w-full py-3.5 text-center text-[15px] font-medium text-[#2d3a52] rounded-[7px] border border-[#e2e6ef] no-underline hover:bg-[#f8f9fc] transition-colors"
        >
          Go to home
        </Link>
      </div>
    </AuthLayout>
  );
}
