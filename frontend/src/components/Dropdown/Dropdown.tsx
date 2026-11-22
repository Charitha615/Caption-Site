import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Dropdown.css';

export interface DropdownItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

export interface DropdownProps {
  /** Visual content of the trigger. It is rendered inside the dropdown's own <button>. */
  trigger: React.ReactNode;
  /** Accessible name of the trigger button. */
  label: string;
  items: DropdownItem[];
  align?: 'left' | 'right';
  triggerClassName?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

const GAP = 6;
const VIEWPORT_MARGIN = 8;

interface MenuPosition {
  top: number;
  left: number;
  upward: boolean;
}

/**
 * Menu button (WAI-ARIA pattern): Enter/Space/↓ opens, ↑/↓ move, Esc closes and
 * returns focus to the trigger, click outside closes.
 *
 * The menu renders in a portal with fixed positioning, so containers with
 * `overflow: hidden` (e.g. project cards) can never clip it. It opens upward when
 * there is not enough room below, stays inside the viewport, and closes on scroll/resize.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  label,
  items,
  align = 'right',
  triggerClassName = '',
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const focusItem = (dir: 1 | -1 | 'first') => {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (!nodes.length) return;
    const current = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const next = dir === 'first' ? 0 : (current + dir + nodes.length) % nodes.length;
    nodes[next].focus();
  };

  /** Places the menu next to the trigger, flipping upward / clamping to the viewport as needed. */
  const place = useCallback(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!t || !menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const spaceBelow = window.innerHeight - t.bottom;
    const upward = spaceBelow < height + GAP + VIEWPORT_MARGIN && t.top > spaceBelow;
    const top = upward ? Math.max(VIEWPORT_MARGIN, t.top - GAP - height) : Math.min(t.bottom + GAP, window.innerHeight - height - VIEWPORT_MARGIN);
    const rawLeft = align === 'left' ? t.left : t.right - width;
    const left = Math.min(Math.max(VIEWPORT_MARGIN, rawLeft), window.innerWidth - width - VIEWPORT_MARGIN);
    setPosition({ top, left, upward });
  }, [align]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // Measure after the menu is in the DOM (hidden until placed, so it never flashes in the wrong spot).
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    place();
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };
    const handleViewportChange = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return; // scrolling inside the menu
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
    focusItem('first');
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(-1);
    } else if (e.key === 'Tab') {
      // Leaving the menu returns to the page flow at the trigger.
      e.preventDefault();
      close();
    }
  };

  return (
    <div className={`dropdown-wrapper ${isOpen ? 'is-open' : ''}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`dropdown-trigger ${triggerClassName}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation(); // e.g. don't also open the card underneath
          setIsOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !isOpen) {
            e.preventDefault();
            setIsOpen(true);
          } else if (e.key === 'Escape' && isOpen) {
            e.stopPropagation();
            close();
          }
        }}
      >
        {trigger}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className={`dropdown-menu dropdown-menu-floating ${position?.upward ? 'dropdown-menu-upward' : ''}`}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
          >
            {items.map((item) =>
              item.divider ? (
                <div key={item.key} className="dropdown-divider" role="separator" />
              ) : (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={`dropdown-item ${item.danger ? 'dropdown-item-danger' : ''}`}
                  onClick={() => {
                    close();
                    item.onClick?.();
                  }}
                >
                  <span aria-hidden="true" style={{ display: 'inline-flex' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
