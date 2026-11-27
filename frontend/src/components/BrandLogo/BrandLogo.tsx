import { BRAND } from '../../config/brand';
import './BrandLogo.css';

/** Splits a logo like "name.lk" into the Sinhala name and an English ending; a plain name has no ending. */
function splitLogo(text: string): { name: string; ending: string } {
  const dot = text.lastIndexOf('.');
  if (dot <= 0) return { name: text, ending: '' };
  return { name: text.slice(0, dot), ending: text.slice(dot) };
}

/**
 * The product wordmark (the Sinhala name, optionally with an English ending such as ".lk").
 * Screen readers hear the plain product name ("Sinsub").
 */
export function BrandLogo({ className = '' }: { className?: string }) {
  const { name, ending } = splitLogo(BRAND.logoText);
  return (
    <span className={`brand-logo ${className}`} aria-label={BRAND.name} role="img">
      <span className="brand-logo-si" lang="si" aria-hidden="true">{name}</span>
      {ending && <span className="brand-logo-en" lang="en" aria-hidden="true">{ending}</span>}
    </span>
  );
}
