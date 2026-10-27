import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { Navbar } from '../../components/Navbar/Navbar';
import { ToastContainer } from '../../components/Toast/ToastContainer';
import './AppLayout.css';

export const AppLayout: React.FC = () => {
  const location = useLocation();

  const getPageTitle = (pathname: string): string => {
    if (pathname.includes('/projects/create')) return 'Create New Project';
    if (pathname.startsWith('/projects/')) return 'Video Caption Editor';
    if (pathname.includes('/projects')) return 'Projects Library';
    if (pathname.includes('/settings')) return 'Workspace Settings';
    if (pathname.includes('/profile')) return 'User Profile';
    return 'Dashboard';
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main-content">
        <Navbar title={getPageTitle(location.pathname)} />
        <main className="app-page-wrapper">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};
