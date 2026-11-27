/**
 * Plans shown on the landing page and the upgrade page. Prices are in LKR.
 *
 * Limits and prices mirror backend/config/plans.php and backend/config/billing.php — keep them
 * in step. `price` is per month; `yearlyTotal` is the price for a whole year.
 */
export interface PricingPlan {
  key: 'free' | 'pro';
  name: string;
  price: number;
  yearlyTotal: number;
  features: string[];
  /** Shown greyed out with a cross: what this plan leaves out. */
  missing?: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

export const PRICING_CURRENCY = 'LKR';

/** Caption animations that need Pro (word-by-word highlight). Mirrors backend config/plans.php `premium_animations`. */
export const PRO_ANIMATIONS: ReadonlyArray<string> = ['karaoke', 'highlight'];

export const PRO_PRICES = { monthly: 490, yearly: 3990 } as const;

/** "Save 32%": yearly against twelve monthly payments. */
export const YEARLY_SAVING_PERCENT = Math.round((1 - PRO_PRICES.yearly / (PRO_PRICES.monthly * 12)) * 100);
export const YEARLY_SAVING_LABEL = `Save ${YEARLY_SAVING_PERCENT}%`;

export const PRICING_PLANS: PricingPlan[] = [
  {
    key: 'free',
    name: 'FREE',
    price: 0,
    yearlyTotal: 0,
    features: [
      'සිංහල + English captions with word-level timing',
      '30 caption minutes every month',
      'Videos up to 10 minutes, uploads up to 500 MB',
      '6 caption styles',
      'MP4 export in HD (720p), plus SRT / VTT / TXT',
      'Video editor with subtitles',
      '2 GB storage',
    ],
    missing: ['Small සිංSub watermark on MP4 exports', 'No word-by-word highlight styles or AI tools'],
    description: 'For trying everything out and short reels.',
    buttonText: 'Start free',
    href: '/register',
    isPopular: false,
  },
  {
    key: 'pro',
    name: 'PRO',
    price: PRO_PRICES.monthly,
    yearlyTotal: PRO_PRICES.yearly,
    features: [
      'Everything in Free',
      '600 caption minutes every month',
      'Videos up to 3 hours, uploads up to 4 GB',
      'MP4 export up to 4K, no watermark',
      'All caption styles — Spotlight, Hormozi, Word Box, TikTok',
      'AI tools: voice-over, translation, script writer, titles',
      '50 GB storage',
      'Priority WhatsApp support',
    ],
    description: 'For creators who post every week.',
    buttonText: 'Get Pro',
    href: '/register?next=/billing',
    isPopular: true,
  },
];

/** How to pay, under the pricing cards. */
export const PAYMENT_NOTE = 'Pay by bank transfer, then upload the slip or send it on WhatsApp. Pro turns on as soon as we confirm it.';
