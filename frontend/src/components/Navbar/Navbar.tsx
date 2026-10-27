import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Globe,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  Search,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { Dropdown } from '../Dropdown/Dropdown';
import './Navbar.css';

export interface NavbarProps {
  title?: string;
  onSearch?: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ title = 'Dashboard' }) => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const dropdownItems = [
    {
      key: 'profile',
      label: 'My Profile & Subscription',
      icon: <User size={16} />,
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      label: 'Workspace Settings',
      icon: <Settings size={16} />,
      onClick: () => navigate('/settings'),
    },
    {
      key: 'divider-1',
      label: '',
      divider: true,
    },
    {
      key: 'logout',
      label: 'Sign Out',
      icon: <LogOut size={16} />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <header className="app-navbar">
      <div className="navbar-left">
        <h1 className="navbar-title">{title}</h1>

        {/* Global Search Bar */}
        <div className="navbar-search-box">
          <Search size={15} className="navbar-search-icon" />
          <input
            type="text"
            placeholder="Search projects, transcripts, tools..."
            className="navbar-search-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate('/projects');
              }
            }}
          />
          <span className="navbar-search-kbd">⌘K</span>
        </div>
      </div>

      <div className="navbar-right">
        {/* Language Badge */}
        <div className="navbar-lang-badge" title="Unicode Sinhala & English Realtime AI">
          <Globe size={14} />
          <span>🇱🇰 සිංහල / 🇺🇸 EN</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          className="navbar-action-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun size={18} className="theme-icon sun-icon" />
          ) : (
            <Moon size={18} className="theme-icon moon-icon" />
          )}
        </button>

        {/* Help / Docs */}
        <button
          type="button"
          className="navbar-action-btn"
          title="Sinhala AI Captioning Guide & Shortcuts"
          onClick={() => navigate('/settings')}
        >
          <HelpCircle size={18} />
        </button>

        {/* User Dropdown */}
        <Dropdown
          items={dropdownItems}
          align="right"
          trigger={
            <div className="navbar-user-btn">
              <div className="navbar-user-avatar">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="navbar-user-info-text">
                <span className="navbar-user-name">{user?.name || 'Account'}</span>
                <span className="navbar-user-tier">
                  <Sparkles size={10} /> Pro Plan
                </span>
              </div>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
          }
        />
      </div>
    </header>
  );
};
