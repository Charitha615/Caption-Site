import { Link } from 'react-router-dom';
import { BRAND } from '../../config/brand';
import { BrandLogo } from '../../components/BrandLogo/BrandLogo';
import { FEATURE_PAGES, GUIDES } from './content';
import '../Landing/LandingPage.css';
import './Marketing.css';

const YEAR = new Date().getFullYear();

/** Top bar of the public pages (the home page has its own, with in-page links). */
export function MarketingHeader({ lang = 'en' }: { lang?: 'en' | 'si' }) {
  const si = lang === 'si';
  return (
    <header className="sx-nav">
      <div className="sx-wrap sx-nav-inner">
        <Link to={si ? '/si' : '/'} className="sx-brand" aria-label={`${BRAND.name} home`}><BrandLogo /></Link>
        <nav className="sx-nav-links" aria-label="Main">
          <Link to="/sinhala-subtitle-generator">Subtitle generator</Link>
          <Link to="/online-video-editor">Video editor</Link>
          <Link to="/guides">Guides</Link>
          {si ? <Link to="/" lang="en">English</Link> : <Link to="/si" lang="si">සිංහල</Link>}
        </nav>
        <div className="sx-nav-actions">
          <Link to="/login" className="sx-btn sx-btn-quiet sx-btn-sm">{si ? 'Sign in' : 'Sign in'}</Link>
          <Link to="/register" className="sx-btn sx-btn-ink sx-btn-sm">{si ? 'නොමිලේ පටන් ගන්න' : 'Start free'}</Link>
        </div>
      </div>
    </header>
  );
}

/** Footer of every public page: links to all feature pages and guides (internal links help search engines find them). */
export function MarketingFooter() {
  return (
    <footer className="sx-footer">
      <div className="sx-wrap sx-footer-inner">
        <div className="sx-footer-brand">
          <BrandLogo />
          <p lang="si">සිංහල creators ලා වෙනුවෙන් හදපු caption tool එක.</p>
        </div>
        <div className="mk-footer-cols">
          <nav aria-label="Tools" className="mk-footer-col">
            <h2>Tools</h2>
            {FEATURE_PAGES.map((p) => <Link key={p.path} to={p.path}>{p.linkLabel}</Link>)}
            <Link to="/si" lang="si">සිංහලෙන් කියවන්න</Link>
          </nav>
          <nav aria-label="Guides" className="mk-footer-col">
            <h2>Guides</h2>
            {GUIDES.map((p) => <Link key={p.path} to={p.path}>{p.linkLabel}</Link>)}
            <Link to="/guides">All guides</Link>
          </nav>
          <nav aria-label="Account" className="mk-footer-col">
            <h2>{BRAND.name}</h2>
            <Link to="/">Home</Link>
            <Link to="/register">Create a free account</Link>
            <Link to="/login">Sign in</Link>
            <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
          </nav>
        </div>
      </div>
      <div className="sx-wrap sx-footer-bottom">© {YEAR} {BRAND.name} · {BRAND.domain} · Made in Sri Lanka</div>
    </footer>
  );
}
