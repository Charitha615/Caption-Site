import { useMemo } from 'react';
import { BRAND, type BrandConfig } from '../config/brand';

/**
 * Hook to access centralized brand identity tokens.
 * Use this hook to ensure dynamic branding everywhere.
 */
export function useBrand(): BrandConfig {
  return useMemo(() => BRAND, []);
}
