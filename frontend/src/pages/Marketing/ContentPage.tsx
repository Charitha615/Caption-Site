import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { CONTENT_PAGES, contentPage, guidesLabel, guidesOf, guidesPath, homePath, type Block, type ContentPageData, type Lang } from './content';
import { MarketingFooter, MarketingHeader } from './MarketingChrome';
import { NotFoundPage } from '../NotFound/NotFoundPage';

function BlockView({ block }: { block: Block }) {
  if (block.kind === 'p') return <p className="mk-p">{block.text}</p>;
  if (block.kind === 'list') {
    return <ul className="mk-list">{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
  }
  return (
    <ol className="mk-steps">
      {block.items.map((step) => (
        <li key={step.title}>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** "27 November 2026" / "2026 නොවැම්බර් 27" (in UTC, so the prerender and the browser agree). */
const SI_MONTHS = ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'];

function formatDate(date: string, lang: Lang) {
  const d = new Date(`${date}T00:00:00Z`);
  if (lang === 'si') return `${d.getUTCFullYear()} ${SI_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function PageBody({ page }: { page: ContentPageData }) {
  const related = page.related.map((path) => CONTENT_PAGES.find((p) => p.path === path)).filter((p): p is ContentPageData => !!p);
  const si = page.lang === 'si';
  return (
    <div className="landing" lang={page.lang}>
      <a href="#main" className="skip-link">{si ? 'අන්තර්ගතයට යන්න' : 'Skip to content'}</a>
      <MarketingHeader lang={page.lang} />
      <main id="main">
        <article>
          <header className="mk-hero">
            <div className="sx-wrap mk-narrow">
              {page.kind === 'guide' && (
                <nav className="mk-crumbs" aria-label="Breadcrumb">
                  <Link to={homePath(page.lang)}>{si ? 'මුල් පිටුව' : 'Home'}</Link> <span aria-hidden="true">/</span> <Link to={guidesPath(page.lang)}>{guidesLabel(page.lang)}</Link>
                </nav>
              )}
              <p className="sx-kicker">{page.eyebrow}</p>
              <h1 className="mk-h1">{page.h1}</h1>
              <p className="mk-intro">{page.intro}</p>
              <div className="mk-hero-actions">
                <Link to="/register" className="sx-btn sx-btn-accent sx-btn-lg">{page.cta.button} <ArrowRight size={18} aria-hidden="true" /></Link>
                {page.kind === 'guide' && <span className="mk-updated">{si ? 'යාවත්කාලීන කළේ' : 'Updated'} <time dateTime={page.updated}>{formatDate(page.updated, page.lang)}</time></span>}
              </div>
            </div>
          </header>

          <div className="sx-wrap mk-narrow mk-body">
            {page.sections.map((section) => (
              <section key={section.heading} className="mk-section">
                <h2 className="mk-h2">{section.heading}</h2>
                {section.blocks.map((block, i) => <BlockView key={i} block={block} />)}
              </section>
            ))}

            {page.faq && page.faq.length > 0 && (
              <section className="mk-section" aria-labelledby="faq-title">
                <h2 id="faq-title" className="mk-h2">{si ? 'නිතර අසන ප්‍රශ්න' : 'Frequently asked questions'}</h2>
                <div className="sx-faq">
                  {page.faq.map(({ q, a }) => (
                    <details key={q}>
                      <summary>{q} <ChevronDown size={18} aria-hidden="true" /></summary>
                      <p>{a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            <section className="mk-cta">
              <h2>{page.cta.text}</h2>
              <Link to="/register" className="sx-btn sx-btn-light sx-btn-lg">{page.cta.button} <ArrowRight size={18} aria-hidden="true" /></Link>
            </section>

            {related.length > 0 && (
              <nav className="mk-section" aria-labelledby="related-title">
                <h2 id="related-title" className="mk-h2">{si ? 'තවත් කියවන්න' : 'Read next'}</h2>
                <ul className="mk-cards">
                  {related.map((r) => (
                    <li key={r.path}>
                      <Link to={r.path} lang={r.lang}>
                        <strong>{r.h1}</strong>
                        <span>{r.description}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </article>
      </main>
      <MarketingFooter lang={page.lang} />
    </div>
  );
}

/** A feature page, guide or the Sinhala home page, picked by `path`. */
export function ContentPage({ path }: { path: string }) {
  const page = contentPage(path);
  return page ? <PageBody page={page} /> : <NotFoundPage />;
}

const GUIDES_TEXT = {
  en: {
    skip: 'Skip to content',
    h1: 'Guides for Sinhala subtitles and video',
    intro: 'Short, practical how-tos for captions, subtitle files and editing videos for YouTube, TikTok and Reels.',
  },
  si: {
    skip: 'අන්තර්ගතයට යන්න',
    h1: 'සිංහල subtitles සහ video ගැන මාර්ගෝපදේශ',
    intro: 'YouTube, TikTok සහ Reels වලට captions, subtitle files සහ video editing ගැන කෙටි, ප්‍රායෝගික පියවරෙන් පියවර උපදෙස්.',
  },
};

/** The list of guides in one language (/guides, /si/guides). */
export function GuidesPage({ lang = 'en' }: { lang?: Lang }) {
  const text = GUIDES_TEXT[lang];
  return (
    <div className="landing" lang={lang}>
      <a href="#main" className="skip-link">{text.skip}</a>
      <MarketingHeader lang={lang} />
      <main id="main">
        <header className="mk-hero">
          <div className="sx-wrap mk-narrow">
            <p className="sx-kicker">{guidesLabel(lang)}</p>
            <h1 className="mk-h1">{text.h1}</h1>
            <p className="mk-intro">{text.intro}</p>
          </div>
        </header>
        <div className="sx-wrap mk-narrow mk-body">
          <ul className="mk-cards">
            {guidesOf(lang).map((g) => (
              <li key={g.path}>
                <Link to={g.path}>
                  <strong>{g.h1}</strong>
                  <span>{g.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <MarketingFooter lang={lang} />
    </div>
  );
}
