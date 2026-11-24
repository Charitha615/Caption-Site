import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useBrand } from '../../hooks/useBrand';
import { BrandLogo } from '../../components/BrandLogo/BrandLogo';
import { SAMPLE_REVIEWS, type Review } from '../../config/reviews';
import { reviewService } from '../../services/reviewService';
import { TestimonialGlobe, type GlobeTestimonial } from '../../components/ui/TestimonialGlobe/TestimonialGlobe';
import './AuthLayout.css';

const YEAR = new Date().getFullYear();
/** Optional photo behind the panel (e.g. "/images/auth-wallpaper.jpg"); the CSS artwork is used without it. */
const WALLPAPER = (import.meta.env.VITE_AUTH_WALLPAPER ?? '').trim();

/** Longest wait for real reviews before the globe shows the samples alone. */
const REVIEWS_WAIT_MS = 2500;

/**
 * Approved reviews from real users first, then the samples.
 * Nothing is shown until the list arrives (or the wait runs out), so the globe never swaps its reviews mid-view.
 */
function useReviews(): Review[] | null {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  useEffect(() => {
    let done = false;
    const finish = (real: Review[]) => {
      if (done) return;
      done = true;
      setReviews([...real, ...SAMPLE_REVIEWS]);
    };
    const timer = window.setTimeout(() => finish([]), REVIEWS_WAIT_MS);
    reviewService.listPublic()
      .then((list) => finish(list.map((r) => ({ quote: r.body, name: r.name ?? 'A creator', role: r.role ?? 'Creator', rating: r.rating, avatarUrl: r.avatar_url }))))
      .catch(() => finish([]));
    return () => {
      done = true;
      window.clearTimeout(timer);
    };
  }, []);
  return reviews;
}

// Reviews without a known place get pins on open parts of the globe, away from the sample cities.
// No city is shown for them, so the pin is decoration only.
const FREE_SPOTS: [number, number][] = [
  [-33.9, 18.4], [-23.5, -46.6], [-1.3, 36.8], [49.3, -123.1], [43.2, 76.9],
  [19.4, -99.1], [21.3, -157.8], [-12, -77], [-34.6, -58.4], [64.1, -21.9],
];

function toGlobeItems(reviews: Review[]): GlobeTestimonial[] {
  let free = 0;
  return reviews.map((r, i) => {
    const placed = r.lat !== undefined && r.lng !== undefined;
    const spot = placed ? null : FREE_SPOTS[free++ % FREE_SPOTS.length]!;
    return {
      id: `${i}-${r.name}`,
      quote: r.quote,
      highlight: r.highlight,
      name: r.name,
      role: r.role,
      rating: r.rating,
      image: r.avatarUrl,
      city: placed ? r.city : undefined,
      country: placed ? r.country : undefined,
      lat: spot ? spot[0] : r.lat!,
      lng: spot ? spot[1] : r.lng!,
    };
  });
}

/** Decorative wallpaper: drifting colour, grid and grain behind the globe. */
function Wallpaper() {
  return (
    <div className="auth-wall" aria-hidden="true" style={WALLPAPER ? ({ '--auth-wallpaper': `url("${WALLPAPER}")` } as React.CSSProperties) : undefined}>
      <div className={`auth-wall-base ${WALLPAPER ? 'has-photo' : ''}`} />
      <span className="auth-blob is-a" />
      <span className="auth-blob is-b" />
      <span className="auth-blob is-c" />
      <div className="auth-wall-grid" />
      <div className="auth-wall-grain" />
    </div>
  );
}

/** Creator reviews pinned on a spinning globe, beside the auth forms. */
function ReviewsPanel() {
  const reviews = useReviews();
  const items = useMemo(() => (reviews ? toGlobeItems(reviews) : null), [reviews]);

  return (
    <aside className="auth-reviews" aria-label="What creators say">
      <Wallpaper />
      {items && (
        <TestimonialGlobe
          className="auth-globe"
          items={items}
          eyebrow="Loved by Sinhala creators"
          heading="Captions that sound like you, wherever you film."
          autoplay
          interval={6000}
          size={420}
        />
      )}
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
