import React from 'react';
import { Loader2 } from 'lucide-react';
import './FancyButton.css';

interface FancyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'default' | 'sm' | 'lg';
  /** Any CSS colour: renders a glossy button in that colour instead of the default dark one. */
  color?: string;
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

/**
 * Glossy button (dark by default, in light AND dark themes) with a soft inner highlight.
 * Ported from the cubby-ui FancyButton to plain CSS.
 */
export const FancyButton = React.forwardRef<HTMLButtonElement, FancyButtonProps>(function FancyButton(
  { children, size = 'default', color, leftSection, rightSection, isLoading = false, fullWidth = false, className = '', style, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      data-slot="fancy-button"
      className={`fancy-btn is-${size} ${color ? 'is-custom' : ''} ${fullWidth ? 'is-full' : ''} ${className}`}
      style={color ? ({ ...style, '--fancy-color': color } as React.CSSProperties) : style}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2 size={16} className="fancy-btn-spin" aria-hidden="true" /> : leftSection}
      <span className="fancy-btn-label">{children}</span>
      {!isLoading && rightSection}
    </button>
  );
});
