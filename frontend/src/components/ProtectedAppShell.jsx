import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import TrialExpiredGate from './TrialExpiredGate';

export default function ProtectedAppShell() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return (
    <>
      <TrialExpiredGate />
      <Outlet />
    </>
  );
}
