/**
 * Public content pages (features, guides, the Sinhala home page). Each is plain data rendered by
 * ContentPage, prerendered to HTML at build time and listed in the sitemap.
 *
 * Adding a page: add an entry here. Routes, the sitemap, the footer and the guides list pick it up.
 */

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'steps'; items: { title: string; text: string }[] };

export interface Section {
  heading: string;
  blocks: Block[];
}

export interface ContentPageData {
  path: string;
  lang: 'en' | 'si';
  kind: 'feature' | 'guide' | 'home';
  /** Search-result title (the brand is added after it). */
  title: string;
  /** Search-result description, about 150 characters. */
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  sections: Section[];
  faq?: { q: string; a: string }[];
  /** Other pages to link at the end. */
  related: string[];
  /** Guides: when the text last changed (YYYY-MM-DD). */
  updated?: string;
  cta: { text: string; button: string };
  /** Short name for links and the footer. */
  linkLabel: string;
}

export const CONTENT_PAGES: ContentPageData[] = [
  /* ------------------------------------------------------------------ features */
  {
    path: '/sinhala-subtitle-generator',
    lang: 'en',
    kind: 'feature',
    linkLabel: 'Sinhala subtitle generator',
    title: 'Sinhala Subtitle Generator – Auto Captions for Videos',
    description: 'Turn Sinhala speech into accurate, word-timed subtitles in minutes. Edit in the browser, then export SRT, VTT or an MP4 with captions burned in.',
    eyebrow: 'Sinhala subtitle generator',
    h1: 'Automatic Sinhala subtitles for your videos',
    intro: 'Upload a video and get Sinhala subtitles written in proper Sinhala Unicode, with every word timed to the speech. Fix anything in the editor, then download SRT or VTT files or an MP4 with the captions burned in.',
    sections: [
      {
        heading: 'Why creators use it',
        blocks: [
          { kind: 'list', items: [
            'Sinhala speech is written in Sinhala script, and English words inside it stay in English letters, the way people actually speak.',
            'Every word has its own timestamp, so word-by-word highlight styles land exactly on the beat.',
            'Conjuncts like ශ්‍රී and ක්‍ෂ render correctly in the editor, the subtitle files and the exported video.',
            'No software to install: it runs in the browser on a computer or a phone.',
          ] },
        ],
      },
      {
        heading: 'How it works',
        blocks: [
          { kind: 'steps', items: [
            { title: 'Upload your video', text: 'MP4, MOV, WEBM or MKV. Large uploads resume if the connection drops.' },
            { title: 'Get the subtitles', text: 'The speech is transcribed and every word is timed automatically.' },
            { title: 'Edit and style', text: 'Correct any word, adjust timings on the timeline and pick a caption style and font.' },
            { title: 'Export', text: 'Download SRT, VTT or TXT, or render an MP4 from 720p up to 4K with the captions burned in.' },
          ] },
        ],
      },
      {
        heading: 'Already have a script?',
        blocks: [
          { kind: 'p', text: 'Paste your script or an existing SRT file and each word is matched to the speech, so you get perfect spelling without timing anything by hand.' },
        ],
      },
    ],
    faq: [
      { q: 'Is the Sinhala subtitle generator free?', a: 'Yes. The free plan includes 120 caption minutes every month, all caption styles and SRT, VTT and MP4 export.' },
      { q: 'Can it handle Sinhala mixed with English?', a: 'Yes. Mixed speech is common in Sri Lanka, so English words inside Sinhala speech are written in English letters automatically.' },
      { q: 'Which subtitle formats can I download?', a: 'SRT, VTT and plain text, or an MP4 video with the captions burned in.' },
    ],
    related: ['/sinhala-english-mixed-captions', '/guides/add-sinhala-subtitles-to-youtube-videos', '/guides/create-sinhala-srt-file'],
    cta: { text: 'Caption your first video free', button: 'Start free' },
  },
  {
    path: '/sinhala-english-mixed-captions',
    lang: 'en',
    kind: 'feature',
    linkLabel: 'Sinhala + English captions',
    title: 'Sinhala and English Mixed Captions (Singlish-Friendly)',
    description: 'Captions for videos where people switch between Sinhala and English. Sinhala is written in Sinhala, English stays in English, with word-level timing.',
    eyebrow: 'Mixed-language captions',
    h1: 'Captions for the way Sri Lanka really speaks',
    intro: 'Most Sri Lankan videos mix Sinhala and English in the same sentence. Generic tools force everything into one script and the result is hard to read. Sinsub writes each word in the script it was spoken in.',
    sections: [
      {
        heading: 'Readable mixed captions',
        blocks: [
          { kind: 'p', text: 'A sentence like "අද අපි Toyota Aqua එක review කරමු" stays exactly like that. You do not get "ටොයොටා ඇක්වා" or a romanised mess that viewers have to decode.' },
          { kind: 'list', items: [
            'Brand names, product names and technical words stay in English letters.',
            'Add names once (people, places, brands) and they are spelled your way in every caption.',
            'Pure Sinhala and pure English videos work too.',
          ] },
        ],
      },
      {
        heading: 'Built for short-form video',
        blocks: [
          { kind: 'p', text: 'Word-level timing powers highlight styles such as Spotlight, Hormozi and Word Box that make reels, shorts and TikToks easier to follow with the sound off.' },
        ],
      },
    ],
    faq: [
      { q: 'What is Singlish in captions?', a: 'Here it means Sinhala speech with English words mixed in. Sinsub keeps the Sinhala in Sinhala script and the English words in English letters.' },
      { q: 'Can I correct a word that came out wrong?', a: 'Yes. Every word and timing is editable, and the original transcription is kept so you can compare or restore it.' },
    ],
    related: ['/sinhala-subtitle-generator', '/guides/sinhala-captions-for-tiktok-and-reels'],
    cta: { text: 'Try it on your own video', button: 'Start free' },
  },
  {
    path: '/online-video-editor',
    lang: 'en',
    kind: 'feature',
    linkLabel: 'Online video editor',
    title: 'Free Online Video Editor with AI Tools and Sinhala Subtitles',
    description: 'Edit videos in your browser: multi-track timeline, text, music, filters, Sinhala and English subtitles, AI voice-over, silence and noise removal.',
    eyebrow: 'Online video editor',
    h1: 'A simple, powerful video editor in your browser',
    intro: 'Cut, arrange and polish videos without installing anything. Add text, music and subtitles on a multi-track timeline, use AI tools for voice-overs and clean audio, and export when you are done.',
    sections: [
      {
        heading: 'Editing tools',
        blocks: [
          { kind: 'list', items: [
            'Multi-track timeline: split, trim, duplicate, snap and close gaps.',
            'Text presets, title cards, backgrounds and watermarks.',
            'Filters, crop, rotate, speed changes, keyframe animation and transitions.',
            'Music and voice-over tracks with volume, fades and waveforms.',
            'Aspect ratios for YouTube (16:9), Reels and TikTok (9:16) and posts (1:1).',
          ] },
        ],
      },
      {
        heading: 'AI tools',
        blocks: [
          { kind: 'list', items: [
            'Sinhala and English subtitles generated from the speech.',
            'AI voice-over in Sinhala, English, Tamil and many more languages, with speaking styles.',
            'Remove silences and long pauses in one click, keeping picture, sound and subtitles in sync.',
            'Remove background noise such as fans, hiss and traffic.',
            'Script writer, title ideas and automatic highlight picking.',
          ] },
        ],
      },
      {
        heading: 'Your work is kept',
        blocks: [
          { kind: 'p', text: 'The editor saves your project in the browser as you work, so it reopens where you left off after a reload.' },
        ],
      },
    ],
    faq: [
      { q: 'Do I need to download software?', a: 'No. The editor runs in a modern browser such as Chrome, Edge or Brave.' },
      { q: 'Can I add Sinhala subtitles in the video editor?', a: 'Yes. Generate subtitles from the speech, edit them and choose how they look before you export.' },
    ],
    related: ['/sinhala-subtitle-generator', '/guides/sinhala-captions-for-tiktok-and-reels'],
    cta: { text: 'Open the editor and start a video', button: 'Start free' },
  },

  /* -------------------------------------------------------------------- guides */
  {
    path: '/guides/add-sinhala-subtitles-to-youtube-videos',
    lang: 'en',
    kind: 'guide',
    linkLabel: 'Add Sinhala subtitles to YouTube',
    updated: '2026-11-25',
    title: 'How to Add Sinhala Subtitles to a YouTube Video (Step by Step)',
    description: 'Create Sinhala subtitles automatically, fix them, and upload an SRT file to YouTube Studio, or burn the captions into the video.',
    eyebrow: 'Guide',
    h1: 'How to add Sinhala subtitles to a YouTube video',
    intro: 'Subtitles help viewers who watch without sound, and YouTube can use them to understand your video. There are two ways to add Sinhala subtitles: upload a subtitle file, or burn the captions into the video.',
    sections: [
      {
        heading: 'Option 1: upload an SRT file (viewers can turn it on and off)',
        blocks: [
          { kind: 'steps', items: [
            { title: 'Create the subtitles', text: 'Upload your video to Sinsub and let it generate Sinhala subtitles with word timing.' },
            { title: 'Check the text', text: 'Read through once and fix names or words, the timing stays attached to each word.' },
            { title: 'Export SRT', text: 'Download the subtitles as an .srt file.' },
            { title: 'Upload to YouTube Studio', text: 'Open your video in YouTube Studio, go to Subtitles, add the Sinhala language and choose "Upload file" with timing.' },
          ] },
        ],
      },
      {
        heading: 'Option 2: burn the captions into the video',
        blocks: [
          { kind: 'p', text: 'Burned-in captions are always visible and keep your style (font, colour, highlight). This works best for Shorts and for videos that are also shared on Facebook or WhatsApp.' },
          { kind: 'steps', items: [
            { title: 'Pick a caption style', text: 'Choose a style and font in the editor.' },
            { title: 'Export MP4', text: 'Render the video at 720p, 1080p or up to 4K.' },
            { title: 'Upload the new video', text: 'Upload the exported MP4 to YouTube.' },
          ] },
        ],
      },
      {
        heading: 'Tips',
        blocks: [
          { kind: 'list', items: [
            'Keep lines short (about 40 characters) so they are easy to read on a phone.',
            'Add a Sinhala title and description too, so Sinhala searches can find the video.',
            'You can upload both an SRT file and an English translation as separate subtitle tracks.',
          ] },
        ],
      },
    ],
    faq: [
      { q: 'Does YouTube support Sinhala subtitles?', a: 'Yes. Add "Sinhala" as a subtitle language in YouTube Studio and upload an SRT file.' },
      { q: 'Is it better to burn captions or upload SRT?', a: 'SRT lets viewers turn subtitles off and works with YouTube search. Burned-in captions keep your design and show everywhere the video is shared.' },
    ],
    related: ['/guides/create-sinhala-srt-file', '/sinhala-subtitle-generator'],
    cta: { text: 'Make Sinhala subtitles for your next video', button: 'Start free' },
  },
  {
    path: '/guides/sinhala-captions-for-tiktok-and-reels',
    lang: 'en',
    kind: 'guide',
    linkLabel: 'Sinhala captions for TikTok & Reels',
    updated: '2026-11-25',
    title: 'Sinhala Captions for TikTok, Reels and Shorts: A Quick Guide',
    description: 'Add eye-catching, word-by-word Sinhala captions to vertical videos for TikTok, Instagram Reels and YouTube Shorts.',
    eyebrow: 'Guide',
    h1: 'Sinhala captions for TikTok, Reels and Shorts',
    intro: 'Most short videos are watched with the sound off. Bold, word-by-word captions keep people watching. Here is how to make them in Sinhala.',
    sections: [
      {
        heading: 'Steps',
        blocks: [
          { kind: 'steps', items: [
            { title: 'Use a vertical video', text: 'Record or edit in 9:16. In the video editor you can switch the aspect ratio at the top.' },
            { title: 'Generate captions', text: 'Sinhala, English and mixed speech are written in the right script with word timing.' },
            { title: 'Choose a highlight style', text: 'Spotlight, Hormozi or Word Box highlight the word being spoken.' },
            { title: 'Keep captions in the safe area', text: 'Place captions above the bottom bar, where TikTok and Reels show the username and buttons.' },
            { title: 'Export and post', text: 'Export an MP4 with the captions burned in and upload it to each app.' },
          ] },
        ],
      },
      {
        heading: 'What makes captions work on short videos',
        blocks: [
          { kind: 'list', items: [
            'Two to four words on screen at a time.',
            'High contrast: white or yellow text with an outline or a box.',
            'Highlight the spoken word so the eye follows the voice.',
            'Spell brand and product names exactly; add them once to your names list.',
          ] },
        ],
      },
    ],
    faq: [
      { q: 'Should captions be burned in for TikTok?', a: 'Yes. TikTok and Reels do not reliably show uploaded subtitle files, so burned-in captions are the safe choice.' },
    ],
    related: ['/sinhala-english-mixed-captions', '/online-video-editor'],
    cta: { text: 'Make your next reel with captions', button: 'Start free' },
  },
  {
    path: '/guides/create-sinhala-srt-file',
    lang: 'en',
    kind: 'guide',
    linkLabel: 'Create a Sinhala SRT file',
    updated: '2026-11-25',
    title: 'How to Create a Sinhala SRT Subtitle File',
    description: 'What an SRT file is, how to create a Sinhala SRT automatically, and how to avoid broken Sinhala letters in subtitle files.',
    eyebrow: 'Guide',
    h1: 'How to create a Sinhala SRT subtitle file',
    intro: 'An SRT file is a plain text file of numbered subtitle lines with start and end times. Almost every video platform and player accepts it.',
    sections: [
      {
        heading: 'What an SRT file looks like',
        blocks: [
          { kind: 'p', text: 'Each subtitle has a number, a time range such as 00:00:01,200 --> 00:00:03,800, and one or two lines of text. Sinhala text must be saved as UTF-8 so the letters show correctly.' },
        ],
      },
      {
        heading: 'Create one automatically',
        blocks: [
          { kind: 'steps', items: [
            { title: 'Upload the video', text: 'Sinsub transcribes the Sinhala speech and times each word.' },
            { title: 'Review', text: 'Fix spellings and split or merge lines in the editor.' },
            { title: 'Export SRT', text: 'Download the .srt file. It is saved as UTF-8, ready for YouTube, Facebook and video players.' },
          ] },
        ],
      },
      {
        heading: 'Avoid broken Sinhala letters',
        blocks: [
          { kind: 'list', items: [
            'Use Unicode Sinhala, not legacy fonts such as FM Abhaya; legacy text turns into Latin letters on other devices.',
            'Keep the zero-width joiner in conjuncts like ශ්‍රී; some editors strip it.',
            'Open and save the file as UTF-8 if you edit it in a text editor.',
          ] },
        ],
      },
    ],
    faq: [
      { q: 'What is the difference between SRT and VTT?', a: 'Both hold timed subtitles. VTT is used on the web (HTML video) and allows styling; SRT is the most widely supported. Sinsub exports both.' },
    ],
    related: ['/guides/add-sinhala-subtitles-to-youtube-videos', '/sinhala-subtitle-generator'],
    cta: { text: 'Create a Sinhala SRT file now', button: 'Start free' },
  },

  /* ----------------------------------------------------------- Sinhala home */
  {
    path: '/si',
    lang: 'si',
    kind: 'home',
    linkLabel: 'සිංහලෙන්',
    title: 'සිංහල Subtitles සහ Captions ස්වයංක්‍රීයව – Sinsub',
    description: 'ඔබේ video එකට සිංහල සහ English captions ස්වයංක්‍රීයව හදන්න. වචනයෙන් වචනයට timing, ලස්සන styles, SRT සහ MP4 export. නොමිලේ පටන් ගන්න.',
    eyebrow: 'සිංහල creators ලා වෙනුවෙන්',
    h1: 'ඔබේ video වලට සිංහල subtitles ස්වයංක්‍රීයව',
    intro: 'Video එක upload කරන්න, කතා කරන දේ සිංහලෙන් ලියවිලා, හැම වචනයකටම නිවැරදි වෙලාව එක්ක captions ලැබෙනවා. Browser එකේම edit කරලා SRT file එකක් හෝ captions සහිත MP4 එකක් download කරන්න.',
    sections: [
      {
        heading: 'Sinsub වල විශේෂත්වය',
        blocks: [
          { kind: 'list', items: [
            'සිංහලෙන් කියන දේ සිංහල අකුරින්, English වචන English අකුරින්ම ලියවෙනවා.',
            'හැම වචනයකටම වෙනම timing තියෙන නිසා highlight captions හරියටම කටහඬට ගැලපෙනවා.',
            'ශ්‍රී, ක්‍ෂ වගේ බැඳි අකුරු කැඩෙන්නේ නැහැ — editor එකේත්, files වලත්, video එකේත්.',
            'මුකුත් install කරන්න ඕනේ නැහැ. Computer එකේ හෝ phone එකේ browser එකෙන්ම වැඩ.',
          ] },
        ],
      },
      {
        heading: 'වැඩ කරන විදිය',
        blocks: [
          { kind: 'steps', items: [
            { title: 'Upload කරන්න', text: 'MP4, MOV, WEBM හෝ MKV video එකක්. Connection එක කැඩුනත් upload එක නැවත පටන් ගන්නවා.' },
            { title: 'Captions ලැබෙනවා', text: 'කතාව ලියවිලා හැම වචනයකටම timing එක දාලා එනවා.' },
            { title: 'Edit සහ style', text: 'වැරදි වචන හදන්න, timeline එකේ timing වෙනස් කරන්න, style එකක් සහ font එකක් තෝරන්න.' },
            { title: 'Export කරන්න', text: 'SRT, VTT, TXT හෝ captions burn කරපු MP4 (720p සිට 4K දක්වා).' },
          ] },
        ],
      },
      {
        heading: 'Video editor එකත් තියෙනවා',
        blocks: [
          { kind: 'p', text: 'Text, music, filters, AI voice-over, නිහඬ කොටස් සහ background noise ඉවත් කිරීම වගේ tools එක්ක browser එකේම video edit කරන්න පුළුවන්.' },
        ],
      },
    ],
    faq: [
      { q: 'මේක නොමිලේද?', a: 'ඔව්. Free plan එකේ මාසෙට caption minutes 120ක්, හැම caption style එකක්ම, SRT සහ MP4 export තියෙනවා.' },
      { q: 'සිංහල සහ English මිශ්‍ර කතාවට වැඩ කරනවද?', a: 'ඔව්. සිංහල කතාව ඇතුළේ තියෙන English වචන English අකුරින්ම ලියවෙනවා.' },
      { q: 'මගේ videos ආරක්ෂිතද?', a: 'ඔව්. Files private විදියට තියාගන්නවා. Project එකක් delete කළොත් ඒකේ files ත් මැකෙනවා.' },
    ],
    related: ['/sinhala-subtitle-generator', '/guides/add-sinhala-subtitles-to-youtube-videos', '/online-video-editor'],
    cta: { text: 'ඔබේ පළමු video එකට captions හදන්න', button: 'නොමිලේ පටන් ගන්න' },
  },
];

export const GUIDES = CONTENT_PAGES.filter((p) => p.kind === 'guide');
export const FEATURE_PAGES = CONTENT_PAGES.filter((p) => p.kind === 'feature');
export const contentPage = (path: string) => CONTENT_PAGES.find((p) => p.path === path);
