import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Loading } from './Loading/Loading';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return <Loading fullScreen text="Verifying session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
