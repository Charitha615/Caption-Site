import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  PlusCircle,
  Settings,
  User,
  LogOut,
  Sun,
  Moon,
  ArrowUpRight,
  X,
  Gauge,
  MessageSquareHeart,
  Crown,
  Banknote,
  Users,
  Megaphone,
  TrendingUp,
} from 'lucide-react';
import { useBrand } from '../../hooks/useBrand';
import { formatDate } from '../../utils/formatters';
import { useAuthStore } from '../../stores/authStore';
import { useUsageStore, meterPercent } from '../../stores/usageStore';
import { useThemeStore } from '../../stores/themeStore';
import { Button } from '../Button/Button';
import './Sidebar.css';
import { BrandLogo } from '../BrandLogo/BrandLogo';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const linkClass = ({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`;

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const brand = useBrand();
  const { user, logout } = useAuthStore();
  const usage = useUsageStore((s) => s.usage);
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const minutes = usage?.caption_minutes;
  const isPro = Boolean(usage && usage.plan.key !== 'free');
  const percent = minutes ? meterPercent(minutes.used, minutes.limit) : null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className={`app-sidebar ${isOpen ? 'app-sidebar-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-header">
        <NavLink to="/dashboard" className="sidebar-brand-wrapper" aria-label={`${brand.name} dashboard`}>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title"><BrandLogo /></span>
            <span className="sidebar-brand-tagline">{brand.tagline}</span>
          </div>
        </NavLink>
        <button type="button" className="sidebar-icon-btn sidebar-close-btn" onClick={onClose} aria-label="Close menu">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="sidebar-cta" data-tour="new-project">
        <Button variant="primary" fullWidth size="md" startIcon={<PlusCircle size={18} aria-hidden="true" />} onClick={() => navigate('/projects/create')}>
          New project
        </Button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-section-label" aria-hidden="true">WORKSPACE</div>
        <NavLink to="/dashboard" className={linkClass}>
          <LayoutDashboard size={18} aria-hidden="true" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/projects" end={false} className={linkClass} data-tour="projects">
          <FolderKanban size={18} aria-hidden="true" />
          <span>Projects</span>
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          <Settings size={18} aria-hidden="true" />
          <span>Settings</span>
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          <User size={18} aria-hidden="true" />
          <span>Account &amp; usage</span>
        </NavLink>
        <NavLink to="/billing" className={linkClass} data-tour="upgrade">
          <Crown size={18} aria-hidden="true" />
          <span>{isPro ? `${usage?.plan.label ?? 'Pro'} plan` : 'Upgrade to Pro'}</span>
        </NavLink>
        {user?.role === 'admin' && (
          <>
            <div className="sidebar-nav-section-label" aria-hidden="true">ADMIN</div>
            <NavLink to="/admin/reviews" className={linkClass}>
              <MessageSquareHeart size={18} aria-hidden="true" />
              <span>Reviews</span>
            </NavLink>
            <NavLink to="/admin/payments" className={linkClass}>
              <Banknote size={18} aria-hidden="true" />
              <span>Payments</span>
            </NavLink>
            <NavLink to="/admin/signups" className={linkClass}>
              <TrendingUp size={18} aria-hidden="true" />
              <span>Sign-ups</span>
            </NavLink>
            <NavLink to="/admin/notifications" className={linkClass}>
              <Megaphone size={18} aria-hidden="true" />
              <span>Send notifications</span>
            </NavLink>
            <NavLink to="/admin/users" className={linkClass}>
              <Users size={18} aria-hidden="true" />
              <span>Users</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-pro-card" data-tour="usage">
          <div className="pro-card-header">
            <div className="pro-card-badge">
              <Gauge size={13} aria-hidden="true" />
              <span>{usage?.plan.label ?? 'Your'} plan</span>
            </div>
          </div>
          {minutes ? (
            <>
              <p className="pro-card-subtext">
                {minutes.limit === null
                  ? `${minutes.used} caption minutes used`
                  : `${minutes.used} of ${minutes.limit} caption minutes used`}
              </p>
              {percent !== null && (
                <div
                  className="pro-usage-track"
                  role="progressbar"
                  aria-label="Caption minutes used in this 30-day cycle"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <div className={`pro-usage-fill ${percent >= 90 ? 'pro-usage-fill-warn' : ''}`} style={{ width: `${percent}%` }} />
                </div>
              )}
            </>
          ) : (
            <p className="pro-card-subtext">Loading usage…</p>
          )}
          {usage?.period && <p className="pro-card-subtext">Resets {formatDate(usage.period.resets_at ?? usage.period.end)}</p>}
          {isPro && usage?.plan.expires_at && (
            <p className="pro-card-subtext">Pro until {formatDate(usage.plan.expires_at)}</p>
          )}
          {isPro ? (
            <button type="button" className="pro-manage-btn" onClick={() => navigate('/profile')}>
              <span>View usage</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="pro-manage-btn pro-upgrade-btn" onClick={() => navigate('/billing')}>
              <Crown size={14} aria-hidden="true" />
              <span>Upgrade to Pro</span>
            </button>
          )}
        </div>

        <div className="sidebar-user-row">
          <NavLink to="/profile" className="sidebar-user-info">
            <div className="sidebar-avatar" aria-hidden="true">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="sidebar-user-text">
              <div className="sidebar-user-name">{user?.name || 'Account'}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </NavLink>

          <div className="sidebar-actions-group">
            <button
              type="button"
              className="sidebar-icon-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            </button>
            <button type="button" onClick={handleLogout} className="sidebar-icon-btn sidebar-logout-btn" aria-label="Sign out" title="Sign out">
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
