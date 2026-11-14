import React from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  circle = false,
  className = '',
  style = {},
}) => {
  const combinedStyle: React.CSSProperties = {
    width: width ?? '100%',
    height: height ?? '16px',
    ...style,
  };

  return (
    <div
      aria-hidden="true"
      className={`skeleton ${circle ? "skeleton-circle" : ""} ${className}`}
      style={combinedStyle}
    />
  );
};
