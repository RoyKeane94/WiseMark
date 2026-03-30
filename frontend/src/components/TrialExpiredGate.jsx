import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, LogOut } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { authAPI } from '../lib/api';

const ALLOWED_WHEN_EXPIRED = ['/app/goodbye', '/app/settings'];

export default function TrialExpiredGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [upgradeBusy, setUpgradeBusy] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await authAPI.me()).data,
  });

  if (isLoading || !user) return null;

  if (user.billing?.plan_allows_app_use !== false) return null;

  if (ALLOWED_WHEN_EXPIRED.includes(location.pathname)) return null;

  const handleUpgrade = async () => {
    setUpgradeBusy(true);
    try {
      const { data } = await authAPI.createUpgradeCheckoutSession();
      window.location.href = data.checkout_url;
    } catch {
      navigate('/app/settings', { replace: false });
    } finally {
      setUpgradeBusy(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-6"
      style={{ background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
    >
      <div
        className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-2xl border border-slate-200"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <h2
          id="trial-expired-title"
          className="m-0 text-[22px] text-slate-900"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 700 }}
        >
          Your trial has ended
        </h2>
        <p className="mt-3 mb-6 text-[15px] leading-relaxed text-slate-600">
          Upgrade today, download your annotations.
        </p>
        <p className="mb-6 text-sm text-slate-500">
          You need an active subscription to use projects, documents, and the library. You can still export your data or
          upgrade below.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={upgradeBusy}
            className="w-full py-3.5 text-[15px] font-medium text-white rounded-xl border-0 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: '#2d3a52' }}
          >
            {upgradeBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {upgradeBusy ? 'Opening checkout…' : 'Upgrade today'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/goodbye')}
            className="w-full py-3.5 text-[15px] font-medium rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            Download your annotations (Word or JSON)
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/settings')}
            className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 cursor-pointer bg-transparent border-0"
          >
            Account &amp; billing settings
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-1 flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:text-slate-700 cursor-pointer bg-transparent border-0"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
