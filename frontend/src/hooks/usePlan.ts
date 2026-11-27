import { useEffect } from 'react';
import { useUsageStore } from '../stores/usageStore';
import type { PlanFeatures } from '../types/auth';

/** Everything allowed: used until the plan is known, so nothing flashes as locked. */
const ALL_FEATURES: PlanFeatures = { max_export_height: 2160, watermark: false, premium_styles: true, editor_ai: true, priority_support: true };

/**
 * The signed-in user's plan and what it includes (from GET /usage, cached). `known` is false
 * until it has loaded; locks should only be shown once it is true.
 */
export function usePlan() {
  const usage = useUsageStore((s) => s.usage);
  const load = useUsageStore((s) => s.load);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const known = Boolean(usage?.features);
  return {
    known,
    key: usage?.plan.key ?? 'free',
    label: usage?.plan.label ?? 'Free',
    isPro: usage ? usage.plan.key !== 'free' : false,
    expiresAt: usage?.plan.expires_at ?? null,
    features: usage?.features ?? ALL_FEATURES,
  };
}
