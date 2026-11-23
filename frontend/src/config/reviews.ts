/**
 * Sample creator reviews shown beside the sign-in / sign-up forms.
 * Replace with real (permission-given) reviews before launch.
 */
export interface Review {
  quote: string;
  /** Part of the quote to emphasise. Must appear in `quote` exactly. */
  highlight?: string;
  name: string;
  role: string;
  rating: number;
  /** Profile photo (e.g. from Google). Initials are shown when missing. */
  avatarUrl?: string | null;
}

export const SAMPLE_REVIEWS: Review[] = [
  {
    quote: 'Captioning a 10-minute vlog used to take my whole evening. Now the captions are ready before my tea is.',
    highlight: 'ready before my tea is',
    name: 'Kasun Perera',
    role: 'Travel vlogger · 120K subscribers',
    rating: 5,
  },
  {
    quote: 'Finally a tool that writes "Toyota Aqua" in English and the rest in proper Sinhala. My viewers noticed straight away.',
    highlight: 'proper Sinhala',
    name: 'Nadeesha Fernando',
    role: 'Car reviewer, Colombo',
    rating: 5,
  },
  {
    quote: 'The Spotlight style looks exactly the same in the exported video as in the editor. No more surprises after rendering.',
    highlight: 'exactly the same',
    name: 'Ravindu Jayasinghe',
    role: 'Video editor at a digital agency',
    rating: 5,
  },
  {
    quote: 'I paste my script, it matches every word to my voice, and I just fix the timing of one or two lines.',
    highlight: 'matches every word',
    name: 'Tharushi Wickramasinghe',
    role: 'Educator · online A/L classes',
    rating: 5,
  },
  {
    quote: 'Our reels get more watch time with Sinhala captions. Sinsub made it part of our daily routine.',
    highlight: 'more watch time',
    name: 'Dilshan Rathnayake',
    role: 'Social media manager',
    rating: 4,
  },
];
