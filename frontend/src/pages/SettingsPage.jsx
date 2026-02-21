import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { authAPI } from '../lib/api';
import { LogOut, Loader2, ArrowLeft } from 'lucide-react';
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

export default function SettingsPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = () => {
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

  return (
    <div className="min-h-screen bg-slate-50 antialiased" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
        rel="stylesheet"
      />

      <header className="bg-white/92 backdrop-blur-md border-b border-slate-200 py-4 px-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="Back to projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-[1.05rem] font-semibold text-slate-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
            WiseMark
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <div className="max-w-[720px] mx-auto px-6 py-10">
        <h1
          className="m-0 text-[28px] text-slate-950"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 700, letterSpacing: '0.01em' }}
        >
          Account settings
        </h1>

        <div className="mt-8">
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
    </div>
  );
}
