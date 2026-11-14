import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastItem } from '../../stores/toastStore';
import './Toast.css';

const ICONS: Record<ToastItem['type'], React.ReactNode> = {
  success: <CheckCircle2 size={18} className="toast-icon" aria-hidden="true" />,
  error: <AlertCircle size={18} className="toast-icon" aria-hidden="true" />,
  warning: <AlertTriangle size={18} className="toast-icon" aria-hidden="true" />,
  info: <Info size={18} className="toast-icon" aria-hidden="true" />,
};

/**
 * Global notification host. Errors are announced assertively, everything else
 * politely. Type is conveyed by icon + title text, not colour alone.
 */
export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item toast-${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          {ICONS[toast.type]}
          <div className="toast-content">
            {toast.title && <div className="toast-title">{toast.title}</div>}
            <div className="toast-message">{toast.message}</div>
          </div>
          <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="Dismiss notification">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};
