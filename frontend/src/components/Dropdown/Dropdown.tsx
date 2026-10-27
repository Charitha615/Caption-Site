import React, { useState, useRef, useEffect } from 'react';
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
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="dropdown-wrapper" ref={containerRef}>
      <div
        className="dropdown-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          className="dropdown-menu"
          style={{ [align === 'left' ? 'left' : 'right']: 0 }}
        >
          {items.map((item) => {
            if (item.divider) {
              return <div key={item.key} className="dropdown-divider" />;
            }
            return (
              <button
                key={item.key}
                type="button"
                className={`dropdown-item ${item.danger ? 'dropdown-item-danger' : ''}`}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick?.();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
