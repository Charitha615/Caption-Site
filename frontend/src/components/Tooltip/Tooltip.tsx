import React, { useId, useState } from 'react';
import './Tooltip.css';

export interface TooltipProps {
  content: string;
  children: React.ReactElement<{ 'aria-describedby'?: string }>;
  side?: 'top' | 'bottom';
}

/**
 * Lightweight tooltip shown on hover and keyboard focus, linked with aria-describedby.
 * Wrap a focusable element (button/link). Escape hides it.
 */
export const Tooltip: React.FC<TooltipProps> = ({ content, children, side = 'top' }) => {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="tooltip-anchor"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      {React.cloneElement(children, { 'aria-describedby': id })}
      <span id={id} role="tooltip" className={`tooltip tooltip-${side} ${open ? 'tooltip-open' : ''}`}>
        {content}
      </span>
    </span>
  );
};
