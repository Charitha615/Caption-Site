/**
 * Plans shown on the landing page. Prices are in LKR; edit them here only.
 *
 * Limits mirror backend/config/plans.php (free / pro / unlimited) — keep the two in step.
 * `price` is per month when billed monthly; `yearlyPrice` is the per-month price when
 * billed yearly (the card also shows the yearly total).
 */
export interface PricingPlan {
  key: 'free' | 'pro' | 'unlimited';
  name: string;
  price: number;
  yearlyPrice: number;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

export const PRICING_CURRENCY = 'LKR';
export const YEARLY_SAVING_LABEL = 'Save 20%';

export const PRICING_PLANS: PricingPlan[] = [
  {
    key: 'free',
    name: 'FREE',
    price: 0,
    yearlyPrice: 0,
    features: [
      'සිංහල + English captions with word-level timing',
      '120 caption minutes every month',
      'Uploads up to 500 MB per video',
      'All caption styles — Spotlight, Hormozi, Word Box & more',
      'MP4 export up to 4K, plus SRT / VTT / TXT',
      'Runs on your own free Google API key',
    ],
    description: 'Perfect for shorts, reels and trying everything out.',
    buttonText: 'Start free',
    href: '/register',
    isPopular: false,
  },
  {
    key: 'pro',
    name: 'PRO',
    price: 990,
    yearlyPrice: 790,
    features: [
      'Everything in Free',
      '1,200 caption minutes every month',
      'Uploads up to 4 GB — long videos & podcasts',
      'Unlimited MP4 exports',
      '100 GB private storage',
      'Priority support',
    ],
    description: 'For creators who post every week.',
    buttonText: 'Get Pro',
    href: '/register?plan=pro',
    isPopular: true,
  },
  {
    key: 'unlimited',
    name: 'STUDIO',
    price: 2490,
    yearlyPrice: 1990,
    features: [
      'Everything in Pro',
      'Unlimited caption minutes',
      'Uploads up to 8 GB',
      'Unlimited storage',
      'For teams, agencies & channels',
      'Direct WhatsApp support',
    ],
    description: 'For studios and teams captioning every day.',
    buttonText: 'Contact us',
    href: '/register?plan=studio',
    isPopular: false,
  },
];
