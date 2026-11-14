import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { Navbar } from '../../components/Navbar/Navbar';
import { ShortcutsDialog } from '../../components/ShortcutsDialog/ShortcutsDialog';
import { useUsageStore } from '../../stores/usageStore';
import { useSettingsStore } from '../../stores/settingsStore';
import './AppLayout.css';

const TITLES: Array<[RegExp, string]> = [
  [/^\/projects\/create/, 'New project'],
  [/^\/projects\/[^/]+$/, 'Project'],
  [/^\/projects/, 'Projects'],
  [/^\/settings/, 'Settings'],
  [/^\/profile/, 'Account'],
];

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const loadUsage = useUsageStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const title = TITLES.find(([re]) => re.test(location.pathname))?.[1] ?? 'Dashboard';

  useEffect(() => {
    void loadUsage().catch(() => undefined);
    void loadSettings().catch(() => undefined);
  }, [loadUsage, loadSettings]);

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setNavOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (e.key === '?' && !typing) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar isOpen={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <div className="app-nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <div className="app-main-content">
        <Navbar title={title} onMenuClick={() => setNavOpen(true)} onHelpClick={() => setShortcutsOpen(true)} />
        <main id="main-content" className="app-page-wrapper" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <ShortcutsDialog isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};
