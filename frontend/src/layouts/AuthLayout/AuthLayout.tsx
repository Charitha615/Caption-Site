import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useBrand } from '../../hooks/useBrand';
import { ToastContainer } from '../../components/Toast/ToastContainer';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => {
  const brand = useBrand();

  return (
    <div className="auth-layout-container">
      <div className="auth-card">
        <div className="auth-brand-header">
          <div className="auth-logo-badge">
            <Sparkles size={26} />
          </div>
          <h1 className="auth-brand-name">{brand.logoText}</h1>
          <p className="auth-brand-tagline">{brand.tagline}</p>
        </div>

        <Outlet />
      </div>

      <footer className="auth-footer">
        © {new Date().getFullYear()} {brand.name}. All rights reserved.
      </footer>

      <ToastContainer />
    </div>
  );
};
