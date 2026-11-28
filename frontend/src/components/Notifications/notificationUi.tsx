import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Bell, Crown, Film, Gift, Lightbulb, Megaphone, PartyPopper, Sparkles, XCircle } from 'lucide-react';
import type { AppNotification } from '../../services/notificationService';

const ICONS: Record<string, { icon: React.ReactNode; tone: string }> = {
  welcome: { icon: <PartyPopper size={16} />, tone: 'is-brand' },
  payment: { icon: <BadgeCheck size={16} />, tone: 'is-good' },
  payment_rejected: { icon: <XCircle size={16} />, tone: 'is-bad' },
  plan: { icon: <Crown size={16} />, tone: 'is-brand' },
  render: { icon: <Film size={16} />, tone: 'is-good' },
  render_failed: { icon: <AlertTriangle size={16} />, tone: 'is-bad' },
  // Admin messages, by category.
  announcement: { icon: <Megaphone size={16} />, tone: 'is-accent' },
  update: { icon: <Sparkles size={16} />, tone: 'is-brand' },
  offer: { icon: <Gift size={16} />, tone: 'is-offer' },
  tip: { icon: <Lightbulb size={16} />, tone: 'is-tip' },
  important: { icon: <AlertTriangle size={16} />, tone: 'is-bad' },
};

export const CATEGORY_LABELS: Record<string, string> = {
  announcement: '📣 Announcement',
  update: '✨ New feature',
  offer: '🎁 Offer',
  tip: '💡 Tip',
  important: '⚠️ Important',
};

/** The round icon of a notification: by kind, or for admin messages by category. */
export function NotificationIcon({ kind, category }: { kind: string; category?: string | null }) {
  const key = kind === 'admin' ? category ?? 'announcement' : kind;
  const { icon, tone } = ICONS[key] ?? { icon: <Bell size={16} />, tone: '' };
  return <span className={`notif-icon ${tone}`} aria-hidden="true">{icon}</span>;
}

/** Opens a notification's link: pages of the app in place, other sites in a new tab. */
export function openNotificationLink(n: Pick<AppNotification, 'link'>, navigate: NavigateFunction) {
  if (!n.link) return;
  if (n.link.startsWith('/')) navigate(n.link);
  else if (n.link.startsWith('https://')) window.open(n.link, '_blank', 'noopener,noreferrer');
}

/** The button text under an admin message with a link. */
export const buttonText = (n: Pick<AppNotification, 'link' | 'button_label'>) => (n.link ? n.button_label || 'Open' : null);
