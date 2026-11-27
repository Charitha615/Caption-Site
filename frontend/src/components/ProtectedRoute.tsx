import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Loading } from './Loading/Loading';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const location = useLocation();

  if (!isInitialized) {
    return <Loading fullScreen text="Verifying session..." />;
  }

  if (!isAuthenticated) {
    // Come back here after signing in (e.g. the payment page opened from a link).
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <Outlet />;
};
