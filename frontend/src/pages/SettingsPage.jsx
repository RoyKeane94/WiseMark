import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../stores/authStore';
import { authAPI } from '../lib/api';
import { Loader2, Mail, LogOut, CreditCard } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import HighlightLensesSection from '../components/HighlightPresetsSection';

function ConfirmDeleteModal({ onClose, onConfirm, isDeleting }) {
  return (
    <div
      className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-1000 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-[400px] mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="m-0 text-lg font-semibold text-slate-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Delete account?
        </h3>
        <p className="mt-2 mb-6 text-sm text-slate-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          This will permanently delete your account and all your data. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline-block mr-1.5 align-middle" />
                Deleting…
              </>
            ) : (
              'Delete account'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmCancelSubModal({ onClose, onConfirm, isBusy }) {
  return (
    <div
      className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-1000 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-[400px] mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="m-0 text-lg font-semibold text-slate-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Cancel subscription and delete account?
        </h3>
        <p className="mt-2 mb-3 text-sm text-slate-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          This will <strong className="text-slate-900">cancel your subscription in Stripe immediately</strong> and{' '}
          <strong className="text-slate-900">permanently delete your WiseMark account</strong>, including all projects,
          documents, notes, and annotations. This cannot be undone.
        </p>
        <p className="mb-6 text-sm text-slate-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <strong className="text-slate-900">Before you continue:</strong> use{' '}
          <strong className="text-slate-900">Download your annotations (Word or JSON)</strong> in the Plan section on this page
          and save the files to your computer. You will not be able to export after your account is deleted.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Keep subscription
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-70 cursor-pointer"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin inline-block" /> : 'Cancel subscription and delete account'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelSubModal, setShowCancelSubModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [billingMsg, setBillingMsg] = useState('');
  const [error, setError] = useState('');
  const upgradeSessionProcessed = useRef(null);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await authAPI.me()).data,
  });

  const billing = user?.billing;
  const isTrial = billing?.account_type === 'trial';
  const isPaid = billing?.account_type === 'paid';
  const hasSub = billing?.has_recurring_subscription;
  const subEnding = billing?.subscription_cancel_at_period_end;
  const trialDays = billing?.trial_days_remaining;

  useEffect(() => {
    const billingParam = searchParams.get('billing');
    const sessionId = searchParams.get('session_id');
    if (billingParam !== 'upgrade' || !sessionId) return;
    if (upgradeSessionProcessed.current === sessionId) return;
    upgradeSessionProcessed.current = sessionId;

    let cancelled = false;
    (async () => {
      try {
        await authAPI.verifyUpgradeSession(sessionId);
        if (!cancelled) {
          setBillingMsg('Your upgrade is complete. Thank you.');
          queryClient.invalidateQueries({ queryKey: ['me'] });
        }
      } catch (e) {
        if (!cancelled) {
          setBillingMsg(e.response?.data?.detail || 'Could not confirm upgrade.');
        }
      } finally {
        if (!cancelled) {
          setSearchParams({}, { replace: true });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams, setSearchParams, queryClient]);

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = async () => {
    setError('');
    setIsDeleting(true);
    try {
      await authAPI.deleteAccount();
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Something went wrong.');
      setIsDeleting(false);
    }
  };

  const handleUpgrade = async () => {
    setBillingMsg('');
    setUpgradeBusy(true);
    try {
      const { data } = await authAPI.createUpgradeCheckoutSession();
      window.location.href = data.checkout_url;
    } catch (e) {
      setBillingMsg(e.response?.data?.detail || 'Could not start checkout.');
    } finally {
      setUpgradeBusy(false);
    }
  };

  const handleConfirmCancelSub = async () => {
    setCancelBusy(true);
    try {
      const { data } = await authAPI.cancelSubscription();
      setShowCancelSubModal(false);
      const msg = data?.detail || 'Your account has been deleted.';
      logout();
      navigate('/login', { replace: true, state: { message: msg } });
    } catch (e) {
      setBillingMsg(e.response?.data?.detail || 'Could not cancel subscription.');
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 antialiased" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
        rel="stylesheet"
      />

      <AppHeader showBack backTo="/app" />

      <div className="max-w-[720px] mx-auto px-6 py-10">
        <h1
          className="m-0 text-[28px] text-slate-950"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 700, letterSpacing: '0.01em' }}
        >
          Settings
        </h1>

        {billingMsg && (
          <div className="mt-6 p-4 rounded-xl bg-slate-100 text-sm text-slate-800 border border-slate-200">
            {billingMsg}
          </div>
        )}

        <section className="mt-8 p-6 bg-white border border-slate-200 rounded-xl">
          <h2 className="text-base font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500" />
            Account
          </h2>
          {user?.email && (
            <p className="text-sm text-slate-600 mt-1 mb-2">
              {user.email}
            </p>
          )}
          <p className="text-sm text-slate-500 mb-4">
            You sign in with a one-time code sent to this email. No password.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </section>

        <section className="mt-6 p-6 bg-white border border-slate-200 rounded-xl">
          <h2 className="text-base font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-500" />
            Plan
          </h2>

          {isTrial && (
            <>
              <p className="text-sm text-slate-600 mt-2 mb-4">
                {typeof trialDays === 'number' && trialDays > 0 ? (
                  <>
                    You have <strong className="text-slate-900">{trialDays}</strong>
                    {trialDays === 1 ? ' day' : ' days'} left on your trial.
                  </>
                ) : (
                  <>Your trial has ended or no end date is set.</>
                )}
              </p>
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={upgradeBusy}
                className="px-4 py-2.5 text-sm font-medium rounded-lg text-white hover:opacity-95 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                style={{ background: '#2d3a52' }}
              >
                {upgradeBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening checkout…
                  </span>
                ) : (
                  'Upgrade today'
                )}
              </button>
              <p className="text-sm text-slate-500 mt-4">
                <button
                  type="button"
                  onClick={() => navigate('/app/goodbye')}
                  className="text-[#2d3a52] font-medium underline-offset-2 hover:underline cursor-pointer bg-transparent border-0 p-0"
                >
                  Download your annotations
                </button>
                {' '}(Word or JSON)
              </p>
            </>
          )}

          {isPaid && hasSub && (
            <>
              {subEnding ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 mb-4">
                  Your subscription was previously set to end at the billing period. Use{' '}
                  <strong>Download your annotations (Word or JSON)</strong> below if you still need a copy. To remove your
                  account immediately, use <strong>Delete account</strong> at the bottom of this page or contact support.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mt-2 mb-2">
                    Cancelling ends your subscription in Stripe right away and permanently deletes your WiseMark account
                    and all data.
                  </p>
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                    Download your notes first: use <strong>Download your annotations (Word or JSON)</strong> below — you
                    cannot export after the account is deleted.
                  </p>
                </>
              )}
              <p className={`text-sm text-slate-500 ${subEnding ? 'mt-2 mb-4' : 'mb-4'}`}>
                <button
                  type="button"
                  onClick={() => navigate('/app/goodbye')}
                  className="text-[#2d3a52] font-medium underline-offset-2 hover:underline cursor-pointer bg-transparent border-0 p-0"
                >
                  Download your annotations
                </button>
                {' '}(Word or JSON)
              </p>
              {!subEnding && (
                <button
                  type="button"
                  onClick={() => setShowCancelSubModal(true)}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                >
                  Cancel subscription and delete account
                </button>
              )}
            </>
          )}

          {isPaid && !hasSub && (
            <>
              <p className="text-sm text-slate-600 mt-2">
                Your plan is active (one-time purchase). There is no recurring subscription to cancel.
              </p>
              <p className="text-sm text-slate-500 mt-4">
                <button
                  type="button"
                  onClick={() => navigate('/app/goodbye')}
                  className="text-[#2d3a52] font-medium underline-offset-2 hover:underline cursor-pointer bg-transparent border-0 p-0"
                >
                  Download your annotations
                </button>
                {' '}(Word or JSON)
              </p>
            </>
          )}

          {!isTrial && !isPaid && (
            <p className="text-sm text-slate-500 mt-2">Plan information is not available.</p>
          )}
        </section>

        <div className="mt-6">
          <HighlightLensesSection />
        </div>

        <section className="mt-8 p-6 bg-white border border-slate-200 rounded-xl">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Delete account</h2>
          <p className="text-sm text-slate-500 mb-4">
            Permanently delete your account and all your projects and documents.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg text-red-600 border border-red-200 bg-white hover:bg-red-50 cursor-pointer"
          >
            Delete account
          </button>
        </section>

        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}
      </div>

      {showDeleteModal && (
        <ConfirmDeleteModal
          onClose={() => !isDeleting && setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
          isDeleting={isDeleting}
        />
      )}

      {showCancelSubModal && (
        <ConfirmCancelSubModal
          onClose={() => !cancelBusy && setShowCancelSubModal(false)}
          onConfirm={handleConfirmCancelSub}
          isBusy={cancelBusy}
        />
      )}
    </div>
  );
}
