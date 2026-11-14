import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Captions, Download, Languages, Sparkles, Type, UploadCloud, Wand2 } from 'lucide-react';
import { BRAND } from '../../config/brand';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './LandingPage.css';

const STEPS = [
  { icon: UploadCloud, title: 'Upload your video', text: 'Drop an MP4, MOV, WEBM or MKV. Large files upload in resumable chunks.' },
  { icon: Wand2, title: 'AI writes the captions', text: 'Speech is transcribed into timed Sinhala or English lines with word timings.' },
  { icon: Type, title: 'Edit and style', text: 'Fix words, drag timings on the timeline and pick a caption style.' },
  { icon: Download, title: 'Export anywhere', text: 'Download SRT, VTT or TXT, or render an MP4 with captions burned in.' },
];

const FEATURES = [
  { icon: Languages, title: 'Sinhala first', text: 'Correct Sinhala Unicode — conjuncts like ශ්‍රී stay intact in the editor, subtitles and rendered video.' },
  { icon: Captions, title: 'Frame-accurate editor', text: 'Drag-to-retime timeline, keyboard shortcuts, undo/redo and autosave.' },
  { icon: Sparkles, title: 'Styles that render the same', text: 'What you see in the browser is what FFmpeg burns into the MP4.' },
];

export const LandingPage: React.FC = () => {
  useDocumentTitle();

  return (
    <div className="landing">
      <a href="#landing-main" className="skip-link">Skip to content</a>
      <header className="landing-nav">
        <Link to="/" className="landing-brand" aria-label={`${BRAND.name} home`}>
          <span className="landing-logo" aria-hidden="true"><Sparkles size={18} /></span>
          <span>{BRAND.name}</span>
        </Link>
        <nav className="landing-nav-actions" aria-label="Account">
          <Link to="/login" className="landing-link">Sign in</Link>
          <Link to="/register" className="landing-btn landing-btn-primary">Get started</Link>
        </nav>
      </header>

      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="hero-title">
          <p className="landing-eyebrow">සිංහල &amp; English · AI captions</p>
          <h1 id="hero-title" className="landing-title">
            Captions for every video,<br />in minutes — not hours.
          </h1>
          <p className="landing-lead">{BRAND.description} Built for Sinhala creators, ready for English.</p>
          <div className="landing-cta-row">
            <Link to="/register" className="landing-btn landing-btn-primary landing-btn-lg">
              Start captioning free <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-lg">I have an account</Link>
          </div>

          <figure className="landing-preview" aria-label="Example caption">
            <div className="landing-preview-frame">
              <span className="landing-preview-caption" lang="si">ආයුබෝවන්! අද අපි <mark>AI උපසිරැසි</mark> හදමු.</span>
            </div>
            <figcaption className="sr-only">A video frame with a Sinhala caption, highlighting the spoken word.</figcaption>
          </figure>
        </section>

        <section className="landing-section" aria-labelledby="how-title">
          <h2 id="how-title" className="landing-h2">How it works</h2>
          <ol className="landing-steps">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="landing-card">
                <span className="landing-step-num" aria-hidden="true">{i + 1}</span>
                <Icon size={22} className="landing-card-icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="features-title">
          <h2 id="features-title" className="landing-h2">Made for real creators</h2>
          <ul className="landing-features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="landing-card">
                <Icon size={22} className="landing-card-icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-final" aria-labelledby="final-title">
          <h2 id="final-title" className="landing-h2">Ready when you are</h2>
          <p>Create a free account and caption your first video today.</p>
          <Link to="/register" className="landing-btn landing-btn-primary landing-btn-lg">
            Create free account <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <span>© {BRAND.name}</span>
        <a href={`mailto:${BRAND.supportEmail}`}>Contact support</a>
      </footer>
    </div>
  );
};
