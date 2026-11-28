import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, X } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { notificationService, type AppNotification, type NotificationPage } from '../../services/notificationService';
import { useNotificationStore } from '../../stores/notificationStore';
import { toAppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';
import { NotificationIcon, buttonText, openNotificationLink } from '../../components/Notifications/notificationUi';
import { formatDateTime } from '../../utils/formatters';
import '../../components/Notifications/Notifications.css';

/** Every notification the user has had, newest first. */
export const NotificationsPage: React.FC = () => {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshBell = useNotificationStore((s) => s.loadRecent);

  const load = useCallback(() => {
    notificationService.list(page, 20)
      .then((d) => { setData(d); setError(null); })
      .catch((err) => setError(toAppError(err, 'Could not load notifications.').message));
  }, [page]);

  useEffect(load, [load]);

  const changed = () => {
    load();
    void refreshBell().catch(() => undefined);
  };

  const open = async (n: AppNotification) => {
    if (!n.read) await notificationService.markRead(n.id).catch(() => undefined);
    changed();
    openNotificationLink(n, navigate);
  };

  return (
    <div className="notif-page">
      <div className="notif-page-head">
        <div>
          <h2 className="page-heading">Notifications</h2>
          <p className="page-subheading">Updates about your videos, payments and plan, and messages from the සිංSub team.</p>
        </div>
        {data && data.unread > 0 && (
          <Button size="sm" variant="outline" startIcon={<CheckCheck size={15} aria-hidden="true" />} onClick={() => void notificationService.markAllRead().then(changed)}>
            Mark all as read
          </Button>
        )}
      </div>

      {error && <div className="form-alert" role="alert">{error}</div>}
      {data && data.notifications.length === 0 && <p className="notif-empty">No notifications yet.</p>}

      <ul className="notif-list">
        {data?.notifications.map((n) => (
          <li key={n.id} className="notif-row">
            <button type="button" className={`notif-item ${n.read ? '' : 'is-unread'}`} onClick={() => void open(n)}>
              <NotificationIcon kind={n.kind} category={n.category} />
              <span className="notif-text">
                <span className="notif-title">{n.title}</span>
                <span className="notif-body">{n.body}</span>
                {buttonText(n) && <span className="notif-cta">{buttonText(n)} →</span>}
                {n.created_at && <span className="notif-time">{formatDateTime(n.created_at)}</span>}
              </span>
              {!n.read && <span className="notif-dot" aria-label="Unread" />}
            </button>
            <button type="button" className="notif-remove" aria-label={`Remove “${n.title}”`} title="Remove" onClick={() => void notificationService.remove(n.id).then(changed)}>
              <X size={15} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {data && data.meta.last_page > 1 && (
        <div className="admin-review-actions">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button>
          <Button size="sm" variant="outline" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>Older</Button>
        </div>
      )}
    </div>
  );
};
