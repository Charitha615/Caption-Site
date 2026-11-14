import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import './ConfirmDialog.css';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' for destructive, irreversible actions. */
  tone?: 'danger' | 'default';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Standard confirmation for destructive or costly actions. Cancel is focused first. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title={title}
    size="sm"
    dismissible={!isLoading}
    footer={
      <>
        <Button variant="secondary" onClick={onCancel} disabled={isLoading} data-autofocus>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} isLoading={isLoading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className={`confirm-dialog confirm-dialog-${tone}`}>
      {tone === 'danger' && (
        <span className="confirm-dialog-icon" aria-hidden="true">
          <AlertTriangle size={20} />
        </span>
      )}
      <div className="confirm-dialog-message">{message}</div>
    </div>
  </Modal>
);
