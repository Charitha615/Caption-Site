import React, { useEffect, useId, useRef, useState } from 'react';
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

/**
 * Menu button (WAI-ARIA pattern): Enter/Space/↓ opens, ↑/↓ move, Esc closes and
 * returns focus to the trigger, click outside closes.
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
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const focusItem = (dir: 1 | -1 | 'first') => {
    const nodes = Array.from(containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (!nodes.length) return;
    const current = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const next = dir === 'first' ? 0 : (current + dir + nodes.length) % nodes.length;
    nodes[next].focus();
  };

  useEffect(() => {
    onOpenChange?.(isOpen);
    if (!isOpen) {
      setOpenUpward(false);
      return;
    }

    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If cramped below (< 160px) and there's more room above, flip upward
      if (spaceBelow < 160 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    focusItem('first'); // menu is in the DOM once this effect runs
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className={`dropdown-wrapper ${isOpen ? 'is-open' : ''}`}
      ref={containerRef}
      onKeyDown={(e) => {
        if (!isOpen) return;
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
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`dropdown-trigger ${triggerClassName}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          id={menuId}
          className={`dropdown-menu ${openUpward ? 'dropdown-menu-upward' : ''}`}
          role="menu"
          aria-label={label}
          style={{ [align === 'left' ? 'left' : 'right']: 0 }}
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
        </div>
      )}
    </div>
  );
};
