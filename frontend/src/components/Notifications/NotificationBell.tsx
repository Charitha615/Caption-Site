import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import type { AppNotification } from '../../services/notificationService';
import { NotificationIcon, buttonText, openNotificationLink } from './notificationUi';
import { formatTimeAgo } from '../../utils/formatters';
import './Notifications.css';

/** How often the bell checks for new notifications while the app is open. */
const POLL_MS = 60_000;

/** Top-bar bell: unread count, and the latest notifications in a dropdown. */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const panelId = useId();
  const { unread, recent, loaded, refreshUnread, loadRecent, markRead, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Check for new ones now, every minute, and when the tab comes back into view.
  useEffect(() => {
    const check = () => void refreshUnread().catch(() => undefined);
    check();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && check(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    if (!loaded) void loadRecent().then(() => setError(false)).catch(() => setError(true));
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, loaded, loadRecent]);

  const openItem = (n: AppNotification) => {
    void markRead(n);
    setOpen(false);
    openNotificationLink(n, navigate);
  };

  return (
    <div className="notif-bell" ref={rootRef} data-tour="notifications">
      <button
        type="button"
        className="navbar-action-btn notif-bell-btn"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
        title="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className="notif-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" id={panelId} role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="notif-link-btn" onClick={() => void markAllRead().catch(() => undefined)}>
                <CheckCheck size={14} aria-hidden="true" /> Mark all as read
              </button>
            )}
          </div>
          <ul className="notif-list">
            {!loaded && !error && <li className="notif-empty">Loading…</li>}
            {error && <li className="notif-empty">Could not load notifications.</li>}
            {loaded && recent.length === 0 && <li className="notif-empty">You&apos;re all caught up.</li>}
            {recent.map((n) => (
              <li key={n.id}>
                <button type="button" className={`notif-item ${n.read ? '' : 'is-unread'}`} onClick={() => openItem(n)}>
                  <NotificationIcon kind={n.kind} category={n.category} />
                  <span className="notif-text">
                    <span className="notif-title">{n.title}</span>
                    <span className="notif-body">{n.body}</span>
                {buttonText(n) && <span className="notif-cta">{buttonText(n)} →</span>}
                    {n.created_at && <span className="notif-time">{formatTimeAgo(n.created_at)}</span>}
                  </span>
                  {!n.read && <span className="notif-dot" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="notif-panel-foot" onClick={() => { setOpen(false); navigate('/notifications'); }}>
            See all notifications
          </button>
        </div>
      )}
    </div>
  );
};
