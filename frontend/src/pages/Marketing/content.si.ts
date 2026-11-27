/**
 * Sinhala versions of the feature pages and guides. Each lives at /si + the English page's path,
 * so the two are paired automatically (hreflang, the language switch). The Sinhala home (/si) is in content.ts.
 *
 * Written the way Sri Lankan creators speak and search: Sinhala, with the usual English words
 * (video, subtitles, upload, export) kept in English.
 */
import type { ContentPageData } from './content';

const START = 'නොමිලේ පටන් ගන්න';

export const SI_CONTENT_PAGES: ContentPageData[] = [
  /* ------------------------------------------------------------------ features */
  {
    path: '/si/sinhala-subtitle-generator',
    updated: '2026-11-27',
    lang: 'si',
    kind: 'feature',
    linkLabel: 'සිංහල subtitle generator',
    title: 'සිංහල Subtitle Generator – Video වලට Subtitles ස්වයංක්‍රීයව',
    description: 'සිංහල කතාව විනාඩි කිහිපයකින් වචනයෙන් වචනයට timing සහිත subtitles බවට හරවන්න. Browser එකේම edit කරලා SRT, VTT හෝ MP4 export කරන්න.',
    eyebrow: 'සිංහල subtitle generator',
    h1: 'කතාවෙන් සිංහල subtitles, විනාඩි කිහිපයකින්',
    intro: 'Video එක upload කරන්න. කතා කරන දේ නිවැරදි සිංහල Unicode අකුරින් ලියවිලා, හැම වචනයකටම කටහඬට ගැලපෙන timing එකක් එක්ක subtitles ලැබෙනවා. Editor එකේ ඕන දෙයක් හදලා SRT, VTT file එකක් හෝ captions burn කරපු MP4 එකක් download කරගන්න.',
    sections: [
      {
        heading: 'Creators ලා මේක පාවිච්චි කරන්නේ ඇයි',
        blocks: [
          { kind: 'list', items: [
            'සිංහල කතාව සිංහල අකුරින්, ඒ ඇතුළේ තියෙන English වචන English අකුරින්ම — අපි ඇත්තටම කතා කරන විදියටම.',
            'හැම වචනයකටම වෙනම timestamp එකක් තියෙන නිසා word-by-word highlight styles හරියටම කටහඬට ගැලපෙනවා.',
            'ශ්‍රී, ක්‍ෂ වගේ බැඳි අකුරු editor එකේත්, subtitle files වලත්, export කරන video එකේත් හරියටම පේනවා.',
            'Software install කරන්න ඕනේ නැහැ. Computer එකේ හෝ phone එකේ browser එකෙන්ම වැඩ කරනවා.',
          ] },
        ],
      },
      {
        heading: 'වැඩ කරන විදිය',
        blocks: [
          { kind: 'steps', items: [
            { title: 'Video එක upload කරන්න', text: 'MP4, MOV, WEBM හෝ MKV. Connection එක කැඩුනත් ලොකු uploads නැවතුණු තැන ඉඳන්ම ආයෙ පටන් ගන්නවා.' },
            { title: 'Subtitles ලැබෙනවා', text: 'කතාව ස්වයංක්‍රීයව ලියවිලා, හැම වචනයකටම timing එක දාලා එනවා.' },
            { title: 'Edit කරලා style කරන්න', text: 'වැරදි වචනයක් හදන්න, timeline එකේ timing වෙනස් කරන්න, caption style එකක් සහ font එකක් තෝරන්න.' },
            { title: 'Export කරන්න', text: 'SRT, VTT හෝ TXT download කරන්න. නැත්නම් captions burn කරපු MP4 එකක් render කරන්න: Free එකේ HD, Pro එකේ 4K දක්වා.' },
          ] },
        ],
      },
      {
        heading: 'Script එක දැනටමත් තියෙනවද?',
        blocks: [
          { kind: 'p', text: 'ඔබේ script එක හෝ තියෙන SRT file එකක් paste කරන්න. හැම වචනයක්ම කතාවට ගලපලා timing එක දාන නිසා, අතින් timing කරන්නේ නැතුවම නිවැරදි අක්ෂර වින්‍යාසය ලැබෙනවා.' },
        ],
      },
    ],
    faq: [
      { q: 'සිංහල subtitle generator එක නොමිලේද?', a: 'ඔව්. Free plan එකේ මාසෙට caption minutes 30ක්, caption styles 6ක්, SRT, VTT, TXT සහ HD (720p) MP4 export තියෙනවා. Pro (මාසෙට රු. 490) එකේ minutes 600ක්, 4K, හැම style එකක්ම සහ AI tools තියෙනවා.' },
      { q: 'සිංහල එක්ක English මිශ්‍ර කතාවට වැඩ කරනවද?', a: 'ඔව්. ලංකාවේ ගොඩක් අය කතා කරන්නේ එහෙමයි. සිංහල කතාව ඇතුළේ තියෙන English වචන ස්වයංක්‍රීයව English අකුරින්ම ලියවෙනවා.' },
      { q: 'Download කරන්න පුළුවන් subtitle formats මොනවද?', a: 'SRT, VTT සහ plain text. නැත්නම් captions burn කරපු MP4 video එකක්.' },
    ],
    related: ['/si/sinhala-english-mixed-captions', '/si/guides/add-sinhala-subtitles-to-youtube-videos', '/si/guides/create-sinhala-srt-file'],
    cta: { text: 'ඔබේ පළමු video එකට නොමිලේ subtitles හදන්න', button: START },
  },
  {
    path: '/si/sinhala-english-mixed-captions',
    updated: '2026-11-27',
    lang: 'si',
    kind: 'feature',
    linkLabel: 'සිංහල + English captions',
    title: 'සිංහල සහ English මිශ්‍ර Captions – Singlish කතාවටත් හරියටම',
    description: 'සිංහලයි English යි මාරු කර කර කතා කරන videos වලට captions. සිංහල සිංහලෙන්, English වචන English අකුරින්ම, වචනයෙන් වචනයට timing එක්ක.',
    eyebrow: 'මිශ්‍ර භාෂා captions',
    h1: 'ලංකාවේ අපි කතා කරන විදියටම captions',
    intro: 'ලංකාවේ ගොඩක් videos වල එකම වාක්‍යයේ සිංහලයි English යි දෙකම තියෙනවා. සාමාන්‍ය tools හැමදේම එක අකුරු ක්‍රමයකට හරවන නිසා කියවන්න අමාරුයි. Sinsub හැම වචනයක්ම කතා කරපු භාෂාවේ අකුරින්ම ලියනවා.',
    sections: [
      {
        heading: 'කියවන්න ලේසි මිශ්‍ර captions',
        blocks: [
          { kind: 'p', text: '"අද අපි Toyota Aqua එක review කරමු" වගේ වාක්‍යයක් ඒ විදියටම තියෙනවා. "ටොයොටා ඇක්වා" හෝ කියවන්න අමාරු romanised අකුරු ලැබෙන්නේ නැහැ.' },
          { kind: 'list', items: [
            'Brand names, product names සහ technical වචන English අකුරින්ම තියෙනවා.',
            'නම් (අය, තැන්, brands) එක පාරක් add කළාම, හැම caption එකකම ඔබට ඕන විදියටම ලියවෙනවා.',
            'සම්පූර්ණ සිංහල හෝ සම්පූර්ණ English videos වලටත් වැඩ.',
          ] },
        ],
      },
      {
        heading: 'Short videos වලට හදපු',
        blocks: [
          { kind: 'p', text: 'වචනයෙන් වචනයට timing තියෙන නිසා Spotlight, Hormozi, Word Box වගේ highlight styles පාවිච්චි කරන්න පුළුවන්. Sound නැතුව බලන අයටත් reels, shorts සහ TikToks ලේසියෙන් තේරෙනවා.' },
        ],
      },
    ],
    faq: [
      { q: 'Captions වල Singlish කියන්නේ මොකක්ද?', a: 'මෙතන අදහස් කරන්නේ English වචන මිශ්‍ර වුණු සිංහල කතාව. Sinsub සිංහල කොටස සිංහල අකුරින්, English වචන English අකුරින් තියාගන්නවා.' },
      { q: 'වැරදියට ආපු වචනයක් හදන්න පුළුවන්ද?', a: 'ඔව්. හැම වචනයක්ම සහ timing එකක්ම edit කරන්න පුළුවන්. මුල් transcription එකත් තියාගන්න නිසා compare කරන්න හෝ ආපහු ගන්නත් පුළුවන්.' },
    ],
    related: ['/si/sinhala-subtitle-generator', '/si/guides/sinhala-captions-for-tiktok-and-reels'],
    cta: { text: 'ඔබේම video එකකින් try කරලා බලන්න', button: START },
  },
  {
    path: '/si/online-video-editor',
    updated: '2026-11-27',
    lang: 'si',
    kind: 'feature',
    linkLabel: 'Online video editor',
    title: 'නොමිලේ Online Video Editor – AI Tools සහ සිංහල Subtitles',
    description: 'Browser එකේම videos edit කරන්න: multi-track timeline, text, music, filters, සිංහල සහ English subtitles, AI voice-over, noise ඉවත් කිරීම.',
    eyebrow: 'Online video editor',
    h1: 'Browser එකේම සරල, බලවත් video editor එකක්',
    intro: 'මුකුත් install නොකර videos කපන්න, පිළිවෙළට තියන්න, ලස්සන කරන්න. Multi-track timeline එකේ text, music සහ subtitles දාන්න, voice-over සහ පිරිසිදු audio වලට AI tools පාවිච්චි කරන්න, ඉවර වුණාම export කරන්න.',
    sections: [
      {
        heading: 'Editing tools',
        blocks: [
          { kind: 'list', items: [
            'Multi-track timeline: split, trim, duplicate, snap සහ හිස් තැන් වහන එක.',
            'Text presets, title cards, backgrounds සහ watermarks.',
            'Filters, crop, rotate, speed වෙනස් කිරීම, keyframe animation සහ transitions.',
            'Volume, fades සහ waveforms එක්ක music සහ voice-over tracks.',
            'YouTube (16:9), Reels සහ TikTok (9:16), posts (1:1) සඳහා aspect ratios.',
          ] },
        ],
      },
      {
        heading: 'AI tools (Pro)',
        blocks: [
          { kind: 'list', items: [
            'කතාවෙන් සිංහල සහ English subtitles.',
            'සිංහල, English, දෙමළ ඇතුළු භාෂා ගොඩකින් AI voice-over, විවිධ කතා කරන styles එක්ක.',
            'නිහඬ කොටස් සහ දිග නැවතීම් එක click එකකින් අයින් කරන්න — පින්තූරය, sound සහ subtitles sync වෙලාම තියෙනවා.',
            'Fan, hiss, traffic වගේ background noise අයින් කරන්න.',
            'Script writer, title ideas සහ හොඳම කොටස් (highlights) ස්වයංක්‍රීයව තෝරන එක.',
          ] },
        ],
      },
      {
        heading: 'ඔබේ වැඩ නැති වෙන්නේ නැහැ',
        blocks: [
          { kind: 'p', text: 'වැඩ කරන ගමන් editor එක project එක browser එකේ save කරනවා. Page එක reload කළත් නැවැත්තුව තැනින්ම open වෙනවා.' },
        ],
      },
    ],
    faq: [
      { q: 'Software download කරන්න ඕනෙද?', a: 'නැහැ. Chrome, Edge හෝ Brave වගේ අලුත් browser එකක editor එක වැඩ කරනවා.' },
      { q: 'Video editor එකේ සිංහල subtitles දාන්න පුළුවන්ද?', a: 'ඔව්. කතාවෙන් subtitles හදලා, edit කරලා, export කරන්න කලින් ඒවායේ පෙනුම තෝරන්න පුළුවන්.' },
    ],
    related: ['/si/sinhala-subtitle-generator', '/si/guides/sinhala-captions-for-tiktok-and-reels'],
    cta: { text: 'Editor එක open කරලා video එකක් පටන් ගන්න', button: START },
  },

  /* -------------------------------------------------------------------- guides */
  {
    path: '/si/guides/add-sinhala-subtitles-to-youtube-videos',
    updated: '2026-11-27',
    lang: 'si',
    kind: 'guide',
    linkLabel: 'YouTube වලට සිංහල subtitles',
    title: 'YouTube Video වලට සිංහල Subtitles දාන විදිය – පියවරෙන් පියවර',
    description: 'සිංහල subtitles ස්වයංක්‍රීයව හදලා, වැරදි හදලා, YouTube Studio එකට SRT file එකක් upload කරන හැටි. නැත්නම් captions video එකටම burn කරන හැටි.',
    eyebrow: 'මාර්ගෝපදේශය',
    h1: 'YouTube video එකකට සිංහල subtitles දාන්නේ කොහොමද',
    intro: 'Sound නැතුව බලන අයට subtitles උදව් වෙනවා. ඒ වගේම ඔබේ video එක ගැන YouTube එකට තේරුම් ගන්නත් ඒවා උදව් වෙනවා. සිංහල subtitles දාන්න ක්‍රම දෙකක් තියෙනවා: subtitle file එකක් upload කරන එක, නැත්නම් captions video එකටම burn කරන එක.',
    sections: [
      {
        heading: 'ක්‍රමය 1: SRT file එකක් upload කරන්න (බලන අයට on/off කරන්න පුළුවන්)',
        blocks: [
          { kind: 'steps', items: [
            { title: 'Subtitles හදන්න', text: 'Video එක Sinsub එකට upload කරලා, වචන timing එක්ක සිංහල subtitles හදාගන්න.' },
            { title: 'Text එක check කරන්න', text: 'එක පාරක් කියවලා නම් හෝ වචන හදන්න. Timing එක හැම වචනයකටම සම්බන්ධ වෙලාම තියෙනවා.' },
            { title: 'SRT export කරන්න', text: 'Subtitles .srt file එකක් විදියට download කරන්න.' },
            { title: 'YouTube Studio එකට upload කරන්න', text: 'YouTube Studio එකේ video එක open කරලා Subtitles වලට යන්න. Sinhala භාෂාව add කරලා "Upload file" → "With timing" තෝරන්න.' },
          ] },
        ],
      },
      {
        heading: 'ක්‍රමය 2: Captions video එකටම burn කරන්න',
        blocks: [
          { kind: 'p', text: 'Burn කරපු captions හැම වෙලාවෙම පේනවා, ඔබේ style එකත් (font, පාට, highlight) එහෙමම තියෙනවා. Shorts වලටයි, Facebook හෝ WhatsApp වලත් share කරන videos වලටයි මේක හොඳම ක්‍රමය.' },
          { kind: 'steps', items: [
            { title: 'Caption style එකක් තෝරන්න', text: 'Editor එකේ style එකක් සහ font එකක් තෝරන්න.' },
            { title: 'MP4 export කරන්න', text: 'Video එක HD (720p) වලින්, නැත්නම් Pro එකේ 1080p සිට 4K දක්වා render කරන්න.' },
            { title: 'අලුත් video එක upload කරන්න', text: 'Export කරපු MP4 එක YouTube එකට upload කරන්න.' },
          ] },
        ],
      },
      {
        heading: 'Tips',
        blocks: [
          { kind: 'list', items: [
            'Phone එකේ කියවන්න ලේසි වෙන්න lines කෙටියෙන් තියන්න (අකුරු 40ක් විතර).',
            'සිංහලෙන් search කරන අයට video එක හම්බෙන්න සිංහල title එකක් සහ description එකකුත් දාන්න.',
            'සිංහල SRT එකයි English පරිවර්තනයකුයි වෙන වෙනම subtitle tracks විදියට upload කරන්න පුළුවන්.',
          ] },
        ],
      },
    ],
    faq: [
      { q: 'YouTube සිංහල subtitles support කරනවද?', a: 'ඔව්. YouTube Studio එකේ "Sinhala" subtitle භාෂාවක් විදියට add කරලා SRT file එකක් upload කරන්න.' },
      { q: 'Captions burn කරන එකද SRT upload කරන එකද හොඳ?', a: 'SRT නම් බලන අයට subtitles off කරන්න පුළුවන්, YouTube search වලටත් උදව් වෙනවා. Burn කරපු captions ඔබේ design එක තියාගෙන, video එක share කරන හැම තැනකම පේනවා.' },
    ],
    related: ['/si/guides/create-sinhala-srt-file', '/si/sinhala-subtitle-generator'],
    cta: { text: 'ඊළඟ video එකට සිංහල subtitles හදන්න', button: START },
  },
  {
    path: '/si/guides/sinhala-captions-for-tiktok-and-reels',
    updated: '2026-11-27',
    lang: 'si',
    kind: 'guide',
    linkLabel: 'TikTok සහ Reels වලට සිංහල captions',
    title: 'TikTok, Reels සහ Shorts වලට සිංහල Captions හදන හැටි',
    description: 'TikTok, Instagram Reels සහ YouTube Shorts වල vertical videos වලට ඇස් ඇදගන්න, වචනයෙන් වචනයට highlight වෙන සිංහල captions දාන හැටි.',
    eyebrow: 'මාර්ගෝපදේශය',
    h1: 'TikTok, Reels සහ Shorts වලට සිංහල captions',
    intro: 'ගොඩක් short videos බලන්නේ sound නැතුව. ලොකු, වචනයෙන් වචනයට එන captions නිසා අය දිගටම බලනවා. සිංහලෙන් ඒවා හදන හැටි මෙන්න.',
    sections: [
      {
        heading: 'පියවර',
        blocks: [
          { kind: 'steps', items: [
            { title: 'Vertical video එකක් පාවිච්චි කරන්න', text: '9:16 විදියට record හෝ edit කරන්න. Video editor එකේ උඩින්ම aspect ratio එක මාරු කරන්න පුළුවන්.' },
            { title: 'Captions හදන්න', text: 'සිංහල, English සහ මිශ්‍ර කතාව හරි අකුරින්, වචන timing එක්ක ලියවෙනවා.' },
            { title: 'Highlight style එකක් තෝරන්න', text: 'Spotlight, Hormozi හෝ Word Box කතා කරන වචනය highlight කරනවා.' },
            { title: 'Captions safe area එක ඇතුළේ තියන්න', text: 'TikTok සහ Reels වල username සහ buttons පේන පහළ කොටසට උඩින් captions තියන්න.' },
            { title: 'Export කරලා post කරන්න', text: 'Captions burn කරපු MP4 එකක් export කරලා හැම app එකකටම upload කරන්න.' },
          ] },
        ],
      },
      {
        heading: 'Short videos වල හොඳට වැඩ කරන captions',
        blocks: [
          { kind: 'list', items: [
            'එක පාරකට screen එකේ වචන දෙක තුනක් හතරක් විතරයි.',
            'හොඳ contrast එකක්: outline එකක් හෝ box එකක් එක්ක සුදු හෝ කහ අකුරු.',
            'කතා කරන වචනය highlight කරන්න, එතකොට ඇස කටහඬ පස්සෙන් යනවා.',
            'Brand සහ product නම් හරියටම ලියන්න; ඒවා names list එකට එක පාරක් add කරන්න.',
          ] },
        ],
      },
    ],
    faq: [
      { q: 'TikTok වලට captions burn කරන්නම ඕනෙද?', a: 'ඔව්. TikTok සහ Reels upload කරන subtitle files හැම වෙලාවෙම පෙන්නන්නේ නැති නිසා, captions burn කරන එක තමයි ආරක්ෂිතම විදිය.' },
    ],
    related: ['/si/sinhala-english-mixed-captions', '/si/online-video-editor'],
    cta: { text: 'ඊළඟ reel එක captions එක්ක හදන්න', button: START },
  },
  {
    path: '/si/guides/create-sinhala-srt-file',
    updated: '2026-11-27',
    lang: 'si',
    kind: 'guide',
    linkLabel: 'සිංහල SRT file එකක් හදන්න',
    title: 'සිංහල SRT Subtitle File එකක් හදන්නේ කොහොමද',
    description: 'SRT file එකක් කියන්නේ මොකක්ද, සිංහල SRT එකක් ස්වයංක්‍රීයව හදන හැටි, subtitle files වල සිංහල අකුරු කැඩෙන එක නවත්තන හැටි.',
    eyebrow: 'මාර්ගෝපදේශය',
    h1: 'සිංහල SRT subtitle file එකක් හදන්නේ කොහොමද',
    intro: 'SRT file එකක් කියන්නේ අංක දාපු subtitle lines, පටන් ගන්න සහ ඉවර වෙන වෙලාවල් එක්ක තියෙන සරල text file එකක්. ගොඩක් video platforms සහ players වල ඒක පාවිච්චි කරන්න පුළුවන්.',
    sections: [
      {
        heading: 'SRT file එකක් පේන්නේ මෙහෙමයි',
        blocks: [
          { kind: 'p', text: 'හැම subtitle එකකටම අංකයක්, 00:00:01,200 --> 00:00:03,800 වගේ වෙලාවක්, text lines එකක් හෝ දෙකක් තියෙනවා. සිංහල අකුරු හරියට පේන්න file එක UTF-8 විදියට save කරන්න ඕනේ.' },
        ],
      },
      {
        heading: 'ස්වයංක්‍රීයව හදාගන්න',
        blocks: [
          { kind: 'steps', items: [
            { title: 'Video එක upload කරන්න', text: 'Sinsub සිංහල කතාව ලියලා හැම වචනයකටම timing දානවා.' },
            { title: 'Check කරන්න', text: 'Editor එකේ අක්ෂර වින්‍යාසය හදන්න, lines කඩන්න හෝ එකතු කරන්න.' },
            { title: 'SRT export කරන්න', text: '.srt file එක download කරන්න. ඒක UTF-8 විදියට save වෙන නිසා YouTube, Facebook සහ video players වලට කෙලින්ම දාන්න පුළුවන්.' },
          ] },
        ],
      },
      {
        heading: 'සිංහල අකුරු කැඩෙන එක නවත්තන්න',
        blocks: [
          { kind: 'list', items: [
            'FM Abhaya වගේ පරණ fonts නෙවෙයි, Unicode සිංහල පාවිච්චි කරන්න. පරණ font වලින් ලියපු text වෙනත් devices වල English අකුරු වලට හැරෙනවා.',
            'ශ්‍රී වගේ බැඳි අකුරු වල zero-width joiner එක තියාගන්න; සමහර editors ඒක අයින් කරනවා.',
            'Text editor එකක file එක edit කරනවා නම් UTF-8 විදියටම open කරලා save කරන්න.',
          ] },
        ],
      },
    ],
    faq: [
      { q: 'SRT සහ VTT අතර වෙනස මොකක්ද?', a: 'දෙකේම තියෙන්නේ timing සහිත subtitles. VTT web එකේ (HTML video) පාවිච්චි වෙනවා, styling කරන්නත් පුළුවන්. SRT තමයි වැඩිම තැන්වල support කරන්නේ. Sinsub දෙකම export කරනවා.' },
    ],
    related: ['/si/guides/add-sinhala-subtitles-to-youtube-videos', '/si/sinhala-subtitle-generator'],
    cta: { text: 'දැන්ම සිංහල SRT file එකක් හදන්න', button: START },
  },
];
