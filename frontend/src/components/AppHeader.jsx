import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../stores/authStore';
import { authAPI } from '../lib/api';
import { ArrowLeft, LogOut } from 'lucide-react';

export default function AppHeader({ showBack = false, backTo = '/app' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await authAPI.me()).data,
  });
  const userInitial = (user?.email?.[0] || user?.username?.[0] || '?').toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navLink = (to, label) => {
    const isActive = location.pathname === to || (to === '/app' && location.pathname === '/app');
    return (
      <button
        type="button"
        onClick={() => navigate(to)}
        className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
          isActive ? 'text-slate-900 bg-slate-100' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {label}
      </button>
    );
  };

  return (
    <header className="bg-white/92 backdrop-blur-md border-b border-slate-200 py-4 px-10 flex items-center justify-between shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-white text-xs font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            W
          </div>
          <span className="text-[1.05rem] font-semibold text-slate-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
            WiseMark
          </span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        {navLink('/app', 'Projects')}
        {navLink('/app/library', 'Library')}
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/app/settings')}
          className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-[13px] font-semibold hover:bg-slate-600 transition-colors cursor-pointer"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
          title="Account settings"
        >
          {userInitial}
        </button>
      </div>
    </header>
  );
}
