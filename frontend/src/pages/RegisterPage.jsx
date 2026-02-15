import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { authAPI } from '../lib/api';
import { pageWrapper, text, bg, btnPrimary } from '../lib/theme';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.register({ email, password });
      const { data } = await authAPI.login(email, password);
      setToken(data.token);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.response?.data;
      setError(
        msg?.email?.[0] || msg?.password?.[0] || 'Registration failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${pageWrapper} ${bg.page} flex items-center justify-center`}>
      <div className="w-full max-w-sm">
        <h1 className={`text-2xl font-semibold ${text.heading} mb-6`}>Create account</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <label className="flex flex-col gap-1">
            <span className={`text-sm ${text.secondary}`}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
              required
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={`text-sm ${text.secondary}`}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
              required
              autoComplete="new-password"
            />
          </label>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <p className={`mt-4 text-sm ${text.muted}`}>
          Already have an account? <Link to="/login" className="text-slate-700 underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
