import React from 'react';
import { LoadingState } from '../LoadingState/LoadingState';

export interface LoadingProps {
  text?: string;
  size?: number;
  fullScreen?: boolean;
}

/** @deprecated use LoadingState — kept so existing screens keep working. */
export const Loading: React.FC<LoadingProps> = ({ text = 'Loading…', size = 32, fullScreen = false }) => (
  <LoadingState label={text} size={size} fullScreen={fullScreen} />
);
