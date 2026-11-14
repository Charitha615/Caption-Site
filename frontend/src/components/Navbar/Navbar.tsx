import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Menu,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  Search,
  HelpCircle,
  Gauge,
} from 'lucide-react';
import { MOD } from '../../features/editor/shortcuts';
import { useUsageStore } from '../../stores/usageStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { Dropdown } from '../Dropdown/Dropdown';
import './Navbar.css';

export interface NavbarProps {
  title?: string;
  onMenuClick?: () => void;
  onHelpClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ title = 'Dashboard', onMenuClick, onHelpClick }) => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const planLabel = useUsageStore((s) => s.usage?.plan.label);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  // Mod+K focuses project search from anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const dropdownItems = [
    {
      key: 'profile',
      label: 'Account & usage',
      icon: <User size={16} />,
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      label: 'Settings',
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
      label: 'Sign out',
      icon: <LogOut size={16} />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <header className="app-navbar">
      <div className="navbar-left">
        <button type="button" className="navbar-action-btn navbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} aria-hidden="true" />
        </button>
        <h1 className="navbar-title">{title}</h1>

        <form
          role="search"
          className="navbar-search-box"
          onSubmit={(e) => {
            e.preventDefault();
            const q = query.trim();
            navigate(q ? `/projects?search=${encodeURIComponent(q)}` : '/projects');
            searchRef.current?.blur();
          }}
        >
          <Search size={15} className="navbar-search-icon" aria-hidden="true" />
          <label htmlFor="navbar-search" className="sr-only">Search projects</label>
          <input
            id="navbar-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && searchRef.current?.blur()}
            placeholder="Search projects…"
            className="navbar-search-input"
            autoComplete="off"
          />
          <kbd className="navbar-search-kbd" aria-hidden="true">{MOD}K</kbd>
        </form>
      </div>

      <div className="navbar-right">
        <button
          type="button"
          className="navbar-action-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} className="theme-icon sun-icon" aria-hidden="true" /> : <Moon size={18} className="theme-icon moon-icon" aria-hidden="true" />}
        </button>

        <button type="button" className="navbar-action-btn" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={onHelpClick}>
          <HelpCircle size={18} aria-hidden="true" />
        </button>

        <Dropdown
          items={dropdownItems}
          align="right"
          label="Account menu"
          trigger={
            <div className="navbar-user-btn">
              <div className="navbar-user-avatar" aria-hidden="true">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="navbar-user-info-text">
                <span className="navbar-user-name">{user?.name || 'Account'}</span>
                <span className="navbar-user-tier">
                  <Gauge size={10} aria-hidden="true" /> {planLabel ? `${planLabel} plan` : '—'}
                </span>
              </div>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            </div>
          }
        />
      </div>
    </header>
  );
};
