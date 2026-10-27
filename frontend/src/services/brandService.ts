import { apiClient } from './api';
import { BRAND, type BrandConfig } from '../config/brand';
import type { ApiResponse } from '../types/api';

export const brandService = {
  async fetchBrandConfig(): Promise<BrandConfig> {
    try {
      const res = await apiClient.get<ApiResponse<BrandConfig>>('/brand');
      return res.data.data;
    } catch {
      // Fallback to local BRAND configuration
      return BRAND;
    }
  },
};
