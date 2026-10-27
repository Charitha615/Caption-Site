import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastItem } from '../../stores/toastStore';
import './Toast.css';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  const renderIcon = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} className="toast-icon" />;
      case 'error':
        return <AlertCircle size={18} className="toast-icon" />;
      case 'warning':
        return <AlertTriangle size={18} className="toast-icon" />;
      case 'info':
      default:
        return <Info size={18} className="toast-icon" />;
    }
  };

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.type}`}>
          {renderIcon(toast.type)}
          <div className="toast-content">
            {toast.title && <div className="toast-title">{toast.title}</div>}
            <div className="toast-message">{toast.message}</div>
          </div>
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
