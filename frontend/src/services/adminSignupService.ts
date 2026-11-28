import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

export type SignupPeriod = 7 | 30 | 90 | 0;

export interface SignupSourceRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  /** Name of the admin's campaign link with these tags, if there is one. */
  link_name?: string | null;
  signups: number;
  /** Of those sign-ups, how many have an approved Pro payment. */
  paid: number;
}

export interface SignupReport {
  days: SignupPeriod;
  totals: { signups: number; paid: number; tracked: number };
  sources: SignupSourceRow[];
}

/** Admin: where sign-ups come from (UTM tags captured on the first visit). */
export const adminSignupService = {
  /** `days: 0` is all time. */
  async report(days: SignupPeriod): Promise<SignupReport> {
    const res = await apiClient.get<ApiResponse<SignupReport>>('/admin/signups', { params: { days } });
    return res.data.data;
  },
};

/** A campaign link the admin made for one post, ad or creator. */
export interface MarketingLink {
  uuid: string;
  name: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  /** Page the link opens, e.g. "/" or "/si". */
  path: string;
  notes: string | null;
  signups: number;
  paid: number;
  last_signup_at: string | null;
  created_at: string | null;
}

export type MarketingLinkInput = Pick<MarketingLink, 'name' | 'source' | 'medium' | 'campaign' | 'path' | 'notes'>;

/** UTM value as the server stores it: lower case, words joined by "-". Mirrors MarketingLink::tag(). */
export const toTag = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);

/** The full link to share, e.g. https://sinsub.cc/?utm_source=facebook&utm_medium=post&utm_campaign=text-captions */
export function campaignUrl(origin: string, link: Pick<MarketingLink, 'source' | 'medium' | 'campaign' | 'path'>): string {
  const params = new URLSearchParams();
  params.set('utm_source', toTag(link.source));
  if (toTag(link.medium)) params.set('utm_medium', toTag(link.medium));
  if (toTag(link.campaign)) params.set('utm_campaign', toTag(link.campaign));
  return `${origin.replace(/\/+$/, '')}${link.path || '/'}?${params.toString()}`;
}

export const marketingLinkService = {
  async list(): Promise<MarketingLink[]> {
    const res = await apiClient.get<ApiResponse<{ links: MarketingLink[] }>>('/admin/marketing-links');
    return res.data.data.links;
  },

  async create(input: MarketingLinkInput): Promise<MarketingLink> {
    const res = await apiClient.post<ApiResponse<{ link: MarketingLink }>>('/admin/marketing-links', input, { silent: true });
    return res.data.data.link;
  },

  async update(uuid: string, input: MarketingLinkInput): Promise<MarketingLink> {
    const res = await apiClient.put<ApiResponse<{ link: MarketingLink }>>(`/admin/marketing-links/${uuid}`, input, { silent: true });
    return res.data.data.link;
  },

  async remove(uuid: string): Promise<void> {
    await apiClient.delete(`/admin/marketing-links/${uuid}`);
  },
};
