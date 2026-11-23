import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface PublicReview {
  uuid: string;
  rating: number;
  body: string;
  role: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

export interface OwnReview extends PublicReview {
  status: ReviewStatus;
  approved_at: string | null;
}

export interface ReviewInput {
  rating: number;
  body: string;
  role?: string;
}

export interface AdminReviewList {
  reviews: OwnReview[];
  counts: Partial<Record<ReviewStatus, number>>;
  meta: { current_page: number; last_page: number; total: number };
}

export const reviewService = {
  /** Approved reviews for the public screens. Never toasts: the screens fall back quietly. */
  async listPublic(): Promise<PublicReview[]> {
    const res = await apiClient.get<ApiResponse<{ reviews: PublicReview[] }>>('/reviews', { silent: true });
    return res.data.data.reviews;
  },
  async mine(): Promise<OwnReview | null> {
    const res = await apiClient.get<ApiResponse<{ review: OwnReview | null }>>('/me/review');
    return res.data.data.review;
  },
  async save(input: ReviewInput): Promise<OwnReview> {
    const res = await apiClient.put<ApiResponse<{ review: OwnReview }>>('/me/review', input);
    return res.data.data.review;
  },
  async remove(): Promise<void> {
    await apiClient.delete('/me/review');
  },
  async adminList(status: ReviewStatus): Promise<AdminReviewList> {
    const res = await apiClient.get<ApiResponse<AdminReviewList>>('/admin/reviews', { params: { status } });
    return res.data.data;
  },
  async moderate(uuid: string, status: 'approved' | 'rejected'): Promise<OwnReview> {
    const res = await apiClient.patch<ApiResponse<{ review: OwnReview }>>(`/admin/reviews/${uuid}`, { status });
    return res.data.data.review;
  },
};
