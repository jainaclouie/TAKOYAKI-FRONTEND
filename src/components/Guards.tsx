import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="splash">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireOwner() {
  const { isOwner } = useAuth();
  return isOwner ? <Outlet /> : <Navigate to="/pos" replace />;
}

export function HomeRedirect() {
  const { isOwner } = useAuth();
  return <Navigate to={isOwner ? '/dashboard' : '/pos'} replace />;
}
