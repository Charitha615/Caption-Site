import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Modal.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Optional description read by screen readers when the dialog opens. */
  description?: string;
  /** Prevent closing via backdrop/Escape (e.g. while a request is running). */
  dismissible?: boolean;
}

/** Open dialogs, innermost last: only the top one reacts to Escape/Tab. */
const modalStack: symbol[] = [];

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: role="dialog" + aria-modal, labelled by its title, traps Tab
 * focus inside, closes on Escape, and returns focus to the element that opened it.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  description,
  dismissible = true,
}) => {
  const titleId = useId();
  const descId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const token = Symbol('modal');
    modalStack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const first = container?.querySelector<HTMLElement>('[data-autofocus]') ?? container?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      modalStack.splice(modalStack.indexOf(token), 1);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, dismissible]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose()}>
      <div
        ref={containerRef}
        className={`modal-container modal-container-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">{title}</h2>
          {dismissible && (
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="modal-body">
          {description && <p id={descId} className="sr-only">{description}</p>}
          {children}
        </div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};
