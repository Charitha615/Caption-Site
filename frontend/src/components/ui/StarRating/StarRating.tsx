import { useId } from 'react';
import { Star } from 'lucide-react';
import './StarRating.css';

const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** 1–5 star picker built on native radio buttons (keyboard and screen-reader friendly). */
export function StarRating({ value, onChange, label = 'Rating' }: { value: number; onChange: (value: number) => void; label?: string }) {
  const name = useId();
  return (
    <fieldset className="star-rating">
      <legend className="sr-only">{label}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={`star-rating-star ${n <= value ? 'is-on' : ''}`} title={LABELS[n - 1]}>
          <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
          <Star size={26} aria-hidden="true" fill={n <= value ? 'currentColor' : 'none'} />
          <span className="sr-only">{n} star{n > 1 ? 's' : ''} — {LABELS[n - 1]}</span>
        </label>
      ))}
      {value > 0 && <span className="star-rating-text" aria-hidden="true">{LABELS[value - 1]}</span>}
    </fieldset>
  );
}

/** Read-only stars. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} aria-hidden="true" className={n <= value ? 'is-on' : ''} fill={n <= value ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}
