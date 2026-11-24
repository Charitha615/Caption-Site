/**
 * Sample creator reviews shown on the globe beside the sign-in / sign-up forms.
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
  /** Where the creator films from. Shown on the card and used for the globe pin. */
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

// Sinhala creators at home and abroad. Ordered east to west, so autoplay turns the globe the way it spins.
export const SAMPLE_REVIEWS: Review[] = [
  {
    quote: 'Did a 25 min podcast episode as a test. Had to fix maybe 6 or 7 words, mostly names. Way better than the auto captions I was using before.',
    highlight: 'Way better than the auto captions',
    name: 'Chamod Senanayake',
    role: 'Podcast host · Lanka Talks NZ',
    rating: 5,
    city: 'Auckland', country: 'NZ', lat: -36.85, lng: 174.76,
  },
  {
    quote: 'Captioning a 10-minute vlog used to take my whole evening. Now the captions are ready before my tea is.',
    highlight: 'ready before my tea is',
    name: 'Kasun Perera',
    role: 'Travel vlogger · 120K subscribers',
    rating: 5,
    city: 'Melbourne', country: 'AU', lat: -37.81, lng: 144.96,
  },
  {
    quote: 'I film in Japan but talk to viewers back home. Place names stay in English, exactly how I say them.',
    highlight: 'exactly how I say them',
    name: 'Sachini Herath',
    role: 'Food & life vlogger',
    rating: 5,
    city: 'Tokyo', country: 'JP', lat: 35.68, lng: 139.69,
  },
  {
    quote: 'Subtitle දාන්න කලින් පැය දෙක තුනක් ගියා. දැන් විනාඩි 10න් ඉවරයි. Spelling ටිකක් හදන්න වෙනවා, ඒත් ගොඩක් හොඳයි.',
    highlight: 'විනාඩි 10න් ඉවරයි',
    name: 'Hiruni Dissanayake',
    role: "Cooking channel · Amma's Kitchen",
    rating: 4,
    city: 'Perth', country: 'AU', lat: -31.95, lng: 115.86,
  },
  {
    quote: 'I post 3 reels a day for clients. Being able to reuse my caption style across projects saves me a lot of clicking.',
    highlight: 'reuse my caption style',
    name: 'Pasindu Gunawardena',
    role: 'Freelance video editor',
    rating: 5,
    city: 'Singapore', country: 'SG', lat: 1.35, lng: 103.82,
  },
  {
    quote: 'Finally a tool that writes "Toyota Aqua" in English and the rest in proper Sinhala. My viewers noticed straight away.',
    highlight: 'proper Sinhala',
    name: 'Nadeesha Fernando',
    role: 'Car reviewer',
    rating: 5,
    city: 'Colombo', country: 'LK', lat: 6.93, lng: 79.85,
  },
  {
    quote: 'Our reels get more watch time with Sinhala captions. Sinsub made it part of our daily routine.',
    highlight: 'more watch time',
    name: 'Dilshan Rathnayake',
    role: 'Social media manager',
    rating: 4,
    city: 'Dubai', country: 'AE', lat: 25.2, lng: 55.27,
  },
  {
    quote: 'Export took a bit longer than I expected on a 4K file, but the captions came out perfect. Kids back home finally understand my vlogs lol.',
    highlight: 'captions came out perfect',
    name: 'Malsha Ekanayake',
    role: 'Family vlogger',
    rating: 4,
    city: 'Stockholm', country: 'SE', lat: 59.33, lng: 18.07,
  },
  {
    quote: 'Lyric videos used to take a weekend of keyframing. Now I upload, pick Word Box and tweak a few words.',
    highlight: 'tweak a few words',
    name: 'Isuru Bandara',
    role: 'Music cover artist',
    rating: 5,
    city: 'Milan', country: 'IT', lat: 45.46, lng: 9.19,
  },
  {
    quote: 'The Spotlight style looks exactly the same in the exported video as in the editor. No more surprises after rendering.',
    highlight: 'exactly the same',
    name: 'Ravindu Jayasinghe',
    role: 'Video editor at a digital agency',
    rating: 5,
    city: 'London', country: 'GB', lat: 51.51, lng: -0.13,
  },
  {
    quote: 'I paste my script, it matches every word to my voice, and I just fix the timing of one or two lines.',
    highlight: 'matches every word',
    name: 'Tharushi Wickramasinghe',
    role: 'Educator · online A/L classes',
    rating: 5,
    city: 'Toronto', country: 'CA', lat: 43.65, lng: -79.38,
  },
  {
    quote: "Tech reviews have a lot of English words mixed in. It keeps iPhone, RAM, Snapdragon etc. in English and doesn't butcher them into Sinhala letters.",
    highlight: 'keeps iPhone, RAM, Snapdragon',
    name: 'Yasiru Samarakoon',
    role: 'Tech reviewer · 48K subscribers',
    rating: 5,
    city: 'Los Angeles', country: 'US', lat: 34.05, lng: -118.24,
  },
];
