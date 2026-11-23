import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Check, Star } from 'lucide-react';
import { useBrand } from '../../hooks/useBrand';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { BrandLogo } from '../../components/BrandLogo/BrandLogo';
import { SAMPLE_REVIEWS, type Review } from '../../config/reviews';
import { reviewService } from '../../services/reviewService';
import './AuthLayout.css';

const YEAR = new Date().getFullYear();
const ROTATE_MS = 7000;
/** Optional photo behind the panel (e.g. "/images/auth-wallpaper.jpg"); the CSS artwork is used without it. */
const WALLPAPER = (import.meta.env.VITE_AUTH_WALLPAPER ?? '').trim();

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

function Quote({ review }: { review: Review }) {
  const { quote, highlight } = review;
  const at = highlight ? quote.indexOf(highlight) : -1;
  if (at < 0 || !highlight) return <>&ldquo;{quote}&rdquo;</>;
  return (
    <>
      &ldquo;{quote.slice(0, at)}<span className="auth-review-hl">{highlight}</span>{quote.slice(at + highlight.length)}&rdquo;
    </>
  );
}

/** Approved reviews from real users; the samples are shown until there are some. */
function useReviews(): Review[] {
  const [reviews, setReviews] = useState<Review[]>(SAMPLE_REVIEWS);
  useEffect(() => {
    let active = true;
    reviewService.listPublic()
      .then((list) => {
        if (!active || list.length === 0) return;
        setReviews(list.map((r) => ({ quote: r.body, name: r.name ?? 'A creator', role: r.role ?? 'Creator', rating: r.rating, avatarUrl: r.avatar_url })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return reviews;
}

/** Decorative wallpaper: drifting colour, grain and floating pieces of the product. */
function Wallpaper() {
  return (
    <div className="auth-wall" aria-hidden="true" style={WALLPAPER ? ({ '--auth-wallpaper': `url("${WALLPAPER}")` } as React.CSSProperties) : undefined}>
      <div className={`auth-wall-base ${WALLPAPER ? 'has-photo' : ''}`} />
      <span className="auth-blob is-a" />
      <span className="auth-blob is-b" />
      <span className="auth-blob is-c" />
      <div className="auth-wall-grid" />
      <div className="auth-wall-grain" />

      <div className="auth-float is-caption">
        <span className="auth-float-label">PREVIEW · Spotlight</span>
        <p lang="si">අද අපි <b>Toyota</b> Aqua එක review කරමු</p>
        <span className="auth-float-progress"><span /></span>
      </div>
      <div className="auth-float is-wave">
        {Array.from({ length: 22 }, (_, i) => <span key={i} style={{ height: `${25 + Math.abs(Math.sin(i * 1.3)) * 75}%` }} />)}
      </div>
      <div className="auth-float is-styles">
        <span className="is-on">Spotlight</span><span>Hormozi</span><span>Word Box</span>
      </div>
      <div className="auth-float is-english">
        <span lang="si" className="is-old">ටොයොටා</span> → <span className="is-new">Toyota</span> <Check size={14} />
      </div>
    </div>
  );
}

/** Rotating creator reviews on the wallpaper, beside the auth forms. */
function ReviewsPanel() {
  const reduce = useReducedMotion();
  const reviews = useReviews();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const review = reviews[index % reviews.length];

  useEffect(() => {
    if (reduce || paused || reviews.length < 2) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % reviews.length), ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reduce, reviews.length]);

  return (
    <aside
      className="auth-reviews"
      aria-label="What creators say"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Wallpaper />

      <div className="auth-review-card">
        <figure key={`${index}-${review.name}`} className="auth-review">
          <div className="auth-review-stars" role="img" aria-label={`${review.rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={16} aria-hidden="true" className={n <= review.rating ? 'is-on' : ''} fill={n <= review.rating ? 'currentColor' : 'none'} />
            ))}
          </div>
          <blockquote><p><Quote review={review} /></p></blockquote>
          <figcaption className="auth-review-person">
            {review.avatarUrl
              ? <img className="auth-review-avatar" src={review.avatarUrl} alt="" referrerPolicy="no-referrer" />
              : <span className="auth-review-avatar" aria-hidden="true">{initials(review.name)}</span>}
            <span>
              <span className="auth-review-name">{review.name}</span>
              <span className="auth-review-role">{review.role}</span>
            </span>
          </figcaption>
        </figure>

        {reviews.length > 1 && (
          <div className="auth-review-dots" role="group" aria-label="Choose a review">
            {reviews.map((r, i) => (
              <button
                key={`${r.name}-${i}`}
                type="button"
                className={i === index % reviews.length ? 'is-on' : ''}
                aria-label={`Review ${i + 1} of ${reviews.length}: ${r.name}`}
                aria-current={i === index % reviews.length || undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export const AuthLayout: React.FC = () => {
  const brand = useBrand();

  return (
    <div className="auth-split">
      <section className="auth-split-form">
        <header className="auth-split-top">
          <Link to="/" className="auth-split-brand" aria-label={`${brand.name} home`}><BrandLogo /></Link>
        </header>
        <main className="auth-split-main">
          <div className="auth-split-inner">
            <Outlet />
          </div>
        </main>
        <footer className="auth-split-footer">© {YEAR} {brand.name} · {brand.tagline}</footer>
      </section>
      <ReviewsPanel />
    </div>
  );
};
