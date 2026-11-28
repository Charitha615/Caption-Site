import { Link, useLocation } from 'react-router-dom';
import { BRAND } from '../../config/brand';
import { BrandLogo } from '../../components/BrandLogo/BrandLogo';
import { featurePagesOf, guidesOf, guidesPath, homePath, otherLanguagePath, type Lang } from './content';
import '../Landing/LandingPage.css';
import './Marketing.css';

const YEAR = new Date().getFullYear();

/** Top bar of the public pages (the home page has its own, with in-page links). */
export function MarketingHeader({ lang = 'en' }: { lang?: Lang }) {
  const si = lang === 'si';
  const { pathname } = useLocation();
  // The language switch opens this same page in the other language when there is one.
  const switchTo = otherLanguagePath(pathname.replace(/\/+$/, '') || '/') ?? homePath(si ? 'en' : 'si');
  const prefix = si ? '/si' : '';
  return (
    <header className="sx-nav">
      <div className="sx-wrap sx-nav-inner">
        <Link to={homePath(lang)} className="sx-brand" aria-label={`${BRAND.name} home`}><BrandLogo /></Link>
        <nav className="sx-nav-links" aria-label="Main">
          <Link to={`${prefix}/sinhala-subtitle-generator`}>Subtitle generator</Link>
          <Link to={`${prefix}/online-video-editor`}>Video editor</Link>
          <Link to={guidesPath(lang)}>{si ? 'මාර්ගෝපදේශ' : 'Guides'}</Link>
          {si ? <Link to={switchTo} lang="en" hrefLang="en">English</Link> : <Link to={switchTo} lang="si" hrefLang="si">සිංහල</Link>}
        </nav>
        <div className="sx-nav-actions">
          <Link to="/login" className="sx-btn sx-btn-quiet sx-btn-sm">Sign in</Link>
          <Link to="/register" className="sx-btn sx-btn-ink sx-btn-sm">{si ? 'නොමිලේ පටන් ගන්න' : 'Start free'}</Link>
        </div>
      </div>
    </header>
  );
}

/** Brand marks (lucide has no TikTok icon, and its brand icons are deprecated). */
function SocialIcon({ name }: { name: 'tiktok' | 'facebook' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {name === 'tiktok' ? (
        <path d="M16.6 5.82A4.3 4.3 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.4-2.47V9.67a5.73 5.73 0 0 0-.8-.06 5.68 5.68 0 0 0-5.69 5.69A5.68 5.68 0 0 0 9.86 21a5.69 5.69 0 0 0 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48z" />
      ) : (
        <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14A28 28 0 0 0 14.64 2C11.93 2 10 3.66 10 6.7v2.8H7v4h3V22h4z" />
      )}
    </svg>
  );
}

/** Footer of every public page: links to all feature pages and guides (internal links help search engines find them). */
export function MarketingFooter({ lang = 'en' }: { lang?: Lang }) {
  const si = lang === 'si';
  return (
    <footer className="sx-footer">
      <div className="sx-wrap sx-footer-inner">
        <div className="sx-footer-brand">
          <BrandLogo />
          <p lang="si">සිංහල creators ලා වෙනුවෙන් හදපු caption tool එක.</p>
          <ul className="mk-social" aria-label={si ? 'අපිව follow කරන්න' : 'Follow us'}>
            {BRAND.social.map((s) => (
              <li key={s.key}>
                <a href={s.url} target="_blank" rel="noopener noreferrer me" aria-label={`${BRAND.name} on ${s.label}`} title={`${s.label} · ${s.handle}`}>
                  <SocialIcon name={s.key} />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="mk-footer-cols">
          <nav aria-label="Tools" className="mk-footer-col">
            <h2>Tools</h2>
            {featurePagesOf(lang).map((p) => <Link key={p.path} to={p.path}>{p.linkLabel}</Link>)}
            {si
              ? <Link to="/" lang="en" hrefLang="en">Read in English</Link>
              : <Link to="/si" lang="si" hrefLang="si">සිංහලෙන් කියවන්න</Link>}
          </nav>
          <nav aria-label="Guides" className="mk-footer-col">
            <h2>{si ? 'මාර්ගෝපදේශ' : 'Guides'}</h2>
            {guidesOf(lang).map((p) => <Link key={p.path} to={p.path}>{p.linkLabel}</Link>)}
            <Link to={guidesPath(lang)}>{si ? 'සියලු මාර්ගෝපදේශ' : 'All guides'}</Link>
          </nav>
          <nav aria-label="Account" className="mk-footer-col">
            <h2>{BRAND.name}</h2>
            <Link to={homePath(lang)}>{si ? 'මුල් පිටුව' : 'Home'}</Link>
            <Link to="/register">{si ? 'නොමිලේ account එකක් හදන්න' : 'Create a free account'}</Link>
            <Link to="/login">Sign in</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
          </nav>
        </div>
      </div>
      <div className="sx-wrap sx-footer-bottom">© {YEAR} {BRAND.name} · {BRAND.domain} · Made in Sri Lanka</div>
    </footer>
  );
}
