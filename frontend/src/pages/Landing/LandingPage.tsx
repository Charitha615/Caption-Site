import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Download, FileText, Languages, Lock, MousePointerClick, Palette, Sparkles, Type, UploadCloud, Wand2, X } from 'lucide-react';
import { BRAND } from '../../config/brand';
import { PRICING_PLANS } from '../../config/pricing';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { BrandLogo } from '../../components/BrandLogo/BrandLogo';
import { Pricing } from '../../components/ui/Pricing/Pricing';
import { LANDING_FAQ as FAQ } from './landingFaq';
import { MarketingFooter } from '../Marketing/MarketingChrome';
import './LandingPage.css';


/** Caption playground: the same words, rendered in each real caption style. */
const PLAY_WORDS = ['අද', 'අපි', 'Toyota', 'Aqua', 'එක', 'review', 'කරමු'];
const PLAY_STYLES = [
  { key: 'spotlight', label: 'Spotlight' },
  { key: 'hormozi', label: 'Hormozi' },
  { key: 'wordbox', label: 'Word Box' },
  { key: 'minimal', label: 'Minimal' },
] as const;
type PlayStyle = (typeof PLAY_STYLES)[number]['key'];

const MESSY = ['අද', 'අපි', 'ටොයොටා', 'ඇක්වා', 'හයිබ්‍රිඩ්', 'එකේ', 'ට්‍රැෆික්', 'mode', 'එක', 'බලමු'];
const CLEAN = ['අද', 'අපි', 'Toyota', 'Aqua', 'hybrid', 'එකේ', 'traffic', 'mode', 'එක', 'බලමු'];

const FLOW = [
  { icon: UploadCloud, title: 'Upload', text: 'Any MP4, MOV, WEBM or MKV. Big files resume if your connection drops.', width: 18 },
  { icon: Languages, title: 'Listen', text: 'Speech is written word by word — Sinhala in Sinhala, English in English.', width: 26 },
  { icon: Wand2, title: 'Time', text: 'Every word gets its own timestamp, so highlights land exactly on the beat.', width: 20 },
  { icon: Palette, title: 'Style', text: 'Pick a style and font, fix any word, drag timings on the timeline.', width: 22 },
  { icon: Download, title: 'Export', text: 'MP4 with captions burned in (720p–4K), or SRT / VTT / TXT.', width: 14 },
];

const SPECS = [
  { icon: Type, title: 'Real Sinhala typography', text: 'Conjuncts like ශ්‍රී and ක්‍ෂ never break — in the editor, the subtitle files and the rendered video.' },
  { icon: Sparkles, title: 'What you see is what exports', text: 'The browser preview and the MP4 follow the same layout rules, so nothing shifts on export.' },
  { icon: FileText, title: 'Bring your own script', text: 'Paste a script or SRT and every word is matched to the speech — no manual timing.' },
  { icon: MousePointerClick, title: 'An editor, not a form', text: 'Timeline drag, split and merge, keyboard shortcuts, undo history and autosave.' },
  { icon: Lock, title: 'Private files', text: 'Videos are stored privately and opened only through short-lived links. Delete a project and its files go too.' },
  { icon: Languages, title: 'Names spelled your way', text: 'Add brands, people and places once — they are written exactly like that in every caption.' },
];


/** Interactive caption preview: pick a style, words light up in time. */
function CaptionPlayground() {
  const reduce = useReducedMotion();
  const [style, setStyle] = useState<PlayStyle>('spotlight');
  const [active, setActive] = useState(2);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % PLAY_WORDS.length), 650);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div className="sx-play">
      <div className="sx-phone" role="img" aria-label={`Caption preview in the ${style} style: ${PLAY_WORDS.join(' ')}`}>
        <div className="sx-phone-notch" aria-hidden="true" />
        <div className="sx-phone-screen" aria-hidden="true">
          <div className="sx-phone-scene" />
          <p className={`sx-cap is-${style}`} lang="si">
            {PLAY_WORDS.map((w, i) => (
              <span key={w} className={i === active ? 'is-on' : i < active ? 'is-past' : ''}>{w}</span>
            ))}
          </p>
          <div className="sx-phone-bar"><span style={{ width: `${((active + 1) / PLAY_WORDS.length) * 100}%` }} /></div>
        </div>
      </div>

      <div className="sx-play-panel">
        <p className="sx-play-label">Try a style</p>
        <div className="sx-style-list" role="radiogroup" aria-label="Caption style">
          {PLAY_STYLES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={style === s.key}
              className={`sx-style-btn ${style === s.key ? 'is-on' : ''}`}
              onClick={() => setStyle(s.key)}
            >
              <span className={`sx-style-swatch is-${s.key}`} aria-hidden="true">අ</span>
              {s.label}
            </button>
          ))}
        </div>
        <div className="sx-words" aria-hidden="true">
          {PLAY_WORDS.map((w, i) => (
            <span key={w} className={i === active ? 'is-on' : ''} lang="si">{w}<small>{(i * 0.42 + 0.3).toFixed(2)}s</small></span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const LandingPage: React.FC = () => {
  useDocumentTitle();
  const reduce = useReducedMotion();
  // Above the fold animates on load (never waits for scrolling); the rest reveals on scroll.
  const intro = reduce ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: 'easeOut' as const } };
  const reveal = reduce
    ? {}
    : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.55, ease: 'easeOut' as const } };

  return (
    <div className="landing">
      <a href="#landing-main" className="skip-link">Skip to content</a>

      <header className="sx-nav">
        <div className="sx-wrap sx-nav-inner">
          <Link to="/" className="sx-brand" aria-label={`${BRAND.name} home`}><BrandLogo /></Link>
          <nav className="sx-nav-links" aria-label="Sections">
            <a href="#difference">Why {BRAND.name}</a>
            <a href="#flow">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <Link to="/guides">Guides</Link>
            <Link to="/si" lang="si">සිංහල</Link>
          </nav>
          <div className="sx-nav-actions">
            <Link to="/login" className="sx-btn sx-btn-quiet sx-btn-sm">Sign in</Link>
            <Link to="/register" className="sx-btn sx-btn-ink sx-btn-sm">Start free</Link>
          </div>
        </div>
      </header>

      <main id="landing-main">
        {/* Hero */}
        <section className="sx-hero" aria-labelledby="hero-title">
          <div className="sx-letters" aria-hidden="true" lang="si">අ ආ ඇ ඉ උ එ ඔ ක ග ච ජ ට ඩ ත ද න ප බ ම ය ර ල ව ස හ ළ</div>
          <div className="sx-wrap sx-hero-grid">
            <motion.div className="sx-hero-copy" {...intro}>
              <p className="sx-chip"><span className="sx-chip-dot" aria-hidden="true" /> සිංහල · English · both at once</p>
              <h1 id="hero-title" className="sx-h1" lang="si">
                වීඩියෝ එකට <span className="sx-mark">සිංහල Captions</span>,<br />
                වචනයෙන් වචනයට.
              </h1>
              <p className="sx-lead">
                Subtitles that understand how Sri Lanka really speaks. Every word timed, every English word spelled in English,
                every style exported exactly as you designed it.
              </p>
              <div className="sx-cta-row">
                <Link to="/register" className="sx-btn sx-btn-accent sx-btn-lg">Caption a video free <ArrowRight size={18} aria-hidden="true" /></Link>
                <a href="#difference" className="sx-btn sx-btn-quiet sx-btn-lg">See the difference</a>
              </div>
              <ul className="sx-proof">
                <li><Check size={15} aria-hidden="true" /> 120 free minutes every month</li>
                <li><Check size={15} aria-hidden="true" /> No card needed</li>
                <li><Check size={15} aria-hidden="true" /> Works on your phone</li>
              </ul>
            </motion.div>
            <motion.div {...intro} transition={reduce ? undefined : { duration: 0.7, delay: 0.15 }}>
              <CaptionPlayground />
            </motion.div>
          </div>
        </section>

        {/* The difference: messy vs ready */}
        <section id="difference" className="sx-section" aria-labelledby="diff-title">
          <div className="sx-wrap">
            <motion.div className="sx-head" {...reveal}>
              <p className="sx-kicker">Why {BRAND.name}</p>
              <h2 id="diff-title" className="sx-h2">Most tools hear Singlish. <span className="sx-ink-accent">We write it properly.</span></h2>
              <p className="sx-sub">Speech tools spell English words in Sinhala letters. {BRAND.name} keeps every word in its own language — automatically.</p>
            </motion.div>
            <div className="sx-compare">
              <motion.div className="sx-compare-card is-before" {...reveal}>
                <p className="sx-compare-label"><X size={15} aria-hidden="true" /> A typical transcript</p>
                <p className="sx-compare-text" lang="si">
                  {MESSY.map((w, i) => <span key={i} className={MESSY[i] !== CLEAN[i] ? 'is-bad' : ''}>{w}</span>)}
                </p>
              </motion.div>
              <div className="sx-compare-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
              <motion.div className="sx-compare-card is-after" {...reveal}>
                <p className="sx-compare-label"><Check size={15} aria-hidden="true" /> Written by {BRAND.name}</p>
                <p className="sx-compare-text" lang="si">
                  {CLEAN.map((w, i) => <span key={i} className={MESSY[i] !== CLEAN[i] ? 'is-good' : ''}>{w}</span>)}
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Flow as an editor timeline */}
        <section id="flow" className="sx-section sx-section-tint" aria-labelledby="flow-title">
          <div className="sx-wrap">
            <motion.div className="sx-head" {...reveal}>
              <p className="sx-kicker">How it works</p>
              <h2 id="flow-title" className="sx-h2">From upload to post in <span className="sx-ink-accent">five clips.</span></h2>
            </motion.div>
            <motion.div className="sx-track" aria-hidden="true" {...reveal}>
              <div className="sx-track-ruler">{Array.from({ length: 11 }, (_, i) => <span key={i}>0:{String(i * 6).padStart(2, '0')}</span>)}</div>
              <div className="sx-track-row">
                {FLOW.map((f, i) => <span key={f.title} className={`sx-clip is-${i}`} style={{ flexGrow: f.width }}>{f.title}</span>)}
              </div>
              <span className="sx-playhead" />
            </motion.div>
            <ol className="sx-flow">
              {FLOW.map(({ icon: Icon, title, text }, i) => (
                <motion.li key={title} className="sx-flow-item" {...reveal} transition={reduce ? undefined : { duration: 0.5, delay: i * 0.06 }}>
                  <span className={`sx-flow-icon is-${i}`}><Icon size={20} aria-hidden="true" /></span>
                  <h3><span className="sx-flow-num">{i + 1}</span> {title}</h3>
                  <p>{text}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* Spec sheet */}
        <section className="sx-section" aria-labelledby="specs-title">
          <div className="sx-wrap sx-specs-grid">
            <motion.div className="sx-specs-intro" {...reveal}>
              <p className="sx-kicker">Built for Sinhala</p>
              <h2 id="specs-title" className="sx-h2">The details other caption tools skip.</h2>
              <p className="sx-sub">Made in Sri Lanka, for creators who post in two languages.</p>
              <Link to="/register" className="sx-btn sx-btn-ink sx-btn-lg">Try it free <ArrowRight size={18} aria-hidden="true" /></Link>
            </motion.div>
            <ul className="sx-specs">
              {SPECS.map(({ icon: Icon, title, text }) => (
                <motion.li key={title} {...reveal}>
                  <span className="sx-spec-icon"><Icon size={18} aria-hidden="true" /></span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="sx-section sx-section-tint" aria-label="Pricing">
          <div className="sx-wrap">
            <Pricing
              plans={PRICING_PLANS}
              title="Simple pricing"
              highlight="120 caption minutes free every month."
              description="Start free. Upgrade only when you post more."
              footnote={
                <span lang="si">
                  Pro වෙන්න <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> එකට message එකක් දාන්න.
                  Payment confirm වුනු ගමන් account එක upgrade වෙනවා. (Card payments coming soon.)
                </span>
              }
            />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="sx-section" aria-labelledby="faq-title">
          <div className="sx-wrap sx-faq-wrap">
            <h2 id="faq-title" className="sx-h2 sx-center">Questions, answered</h2>
            <div className="sx-faq">
              {FAQ.map(({ q, a }) => (
                <details key={q}>
                  <summary>{q}<ChevronDown size={18} aria-hidden="true" /></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final band */}
        <section className="sx-final" aria-labelledby="final-title">
          <div className="sx-final-letters" aria-hidden="true" lang="si">සිංහල සිංහල සිංහල සිංහල සිංහල සිංහල</div>
          <motion.div className="sx-wrap sx-center" {...reveal}>
            <h2 id="final-title" className="sx-final-title" lang="si">ඔයාගේ ඊළඟ වීඩියෝ එකට captions දැන්ම හදන්න.</h2>
            <p>Free to start. Your first video is ready in about the time it takes to make a cup of tea.</p>
            <Link to="/register" className="sx-btn sx-btn-light sx-btn-lg">Start free <ArrowRight size={18} aria-hidden="true" /></Link>
          </motion.div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
};
