import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  PlusCircle,
  Settings,
  User,
  LogOut,
  Sparkles,
  Crown,
  Laptop,
  Sun,
  Moon,
  ArrowUpRight,
} from 'lucide-react';
import { useBrand } from '../../hooks/useBrand';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';
import { useThemeStore } from '../../stores/themeStore';
import { Button } from '../Button/Button';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const brand = useBrand();
  const { user, logout } = useAuthStore();
  const { dashboardData } = useProjectStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const minutesUsed = dashboardData?.summary.caption_minutes_used ?? 5.5;
  const minutesLimit = dashboardData?.summary.caption_minutes_limit ?? 120;
  const usagePercent = Math.min(Math.round((minutesUsed / minutesLimit) * 100), 100);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand-wrapper" onClick={() => navigate('/dashboard')}>
          <div className="sidebar-logo-icon">
            <Sparkles size={20} />
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name-row">
              <span className="sidebar-brand-title">{brand.name}</span>
              <span className="sidebar-pro-badge">
                <Crown size={11} /> PRO
              </span>
            </div>
            <span className="sidebar-brand-tagline">{brand.tagline}</span>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="sidebar-cta">
        <Button
          variant="primary"
          fullWidth
          size="md"
          startIcon={<PlusCircle size={18} />}
          onClick={() => navigate('/projects/create')}
        >
          New Project
        </Button>
      </div>

      {/* Main Navigation Links */}
      <nav className="sidebar-nav">
        <div className="sidebar-nav-section-label">WORKSPACE</div>

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
          }
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
          }
        >
          <FolderKanban size={18} />
          <span>Projects</span>
          <span className="sidebar-link-counter">
            {dashboardData?.recent_projects?.length ?? 0}
          </span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
          }
        >
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
          }
        >
          <User size={18} />
          <span>Account & Plan</span>
        </NavLink>
      </nav>

      {/* Bottom Promo & Account Section */}
      <div className="sidebar-footer">
        {/* Pro Plan Card */}
        <div className="sidebar-pro-card">
          <div className="pro-card-header">
            <div className="pro-card-badge">
              <Crown size={13} />
              <span>{brand.name} Pro</span>
            </div>
            <span className="pro-card-tag">Active</span>
          </div>
          <p className="pro-card-subtext">
            {minutesUsed}m of {minutesLimit}m AI audio quota used.
          </p>
          <div className="pro-usage-track">
            <div className="pro-usage-fill" style={{ width: `${usagePercent}%` }} />
          </div>
          <button
            type="button"
            className="pro-manage-btn"
            onClick={() => navigate('/profile')}
          >
            <span>Manage plan</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        {/* Desktop App Banner */}
        <div className="sidebar-desktop-teaser" title="Download desktop companion app">
          <div className="desktop-icon-box">
            <Laptop size={16} />
          </div>
          <div className="desktop-teaser-info">
            <span className="desktop-teaser-title">Desktop App</span>
            <span className="desktop-teaser-sub">Hardware accelerated</span>
          </div>
          <span className="desktop-teaser-badge">Soon</span>
        </div>

        {/* Theme Switcher & User Profile Row */}
        <div className="sidebar-user-row">
          <div className="sidebar-user-info" onClick={() => navigate('/profile')}>
            <div className="sidebar-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="sidebar-user-text">
              <div className="sidebar-user-name">{user?.name || 'Creator'}</div>
              <div className="sidebar-user-email">{user?.email || 'free-tier'}</div>
            </div>
          </div>

          <div className="sidebar-actions-group">
            {/* Theme Toggle Button */}
            <button
              type="button"
              className="sidebar-icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="sidebar-icon-btn sidebar-logout-btn"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
