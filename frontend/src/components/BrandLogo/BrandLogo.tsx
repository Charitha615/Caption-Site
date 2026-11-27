import { BRAND } from '../../config/brand';
import './BrandLogo.css';

/** Splits "සිංSub" into the Sinhala part (shown in the orange box) and the English rest. */
export function splitLogo(text: string): { mark: string; word: string } {
  const match = /^([඀-෿‌‍]+)(.*)$/u.exec(text.trim());
  if (!match) return { mark: '', word: text };
  return { mark: match[1]!, word: match[2]! };
}

/**
 * The product logo: white "සිං" in an orange box (the same mark as the site icon), then "Sub",
 * read together as "සිංSub" (BRAND.titleName). It scales with the surrounding font size.
 * Screen readers hear the plain product name ("Sinsub").
 */
export function BrandLogo({ className = '' }: { className?: string }) {
  const { mark, word } = splitLogo(BRAND.titleName);
  return (
    <span className={`brand-logo ${className}`} aria-label={BRAND.name} role="img">
      {mark && <span className="brand-logo-mark" lang="si" aria-hidden="true">{mark}</span>}
      {word && <span className="brand-logo-word" lang="en" aria-hidden="true">{word}</span>}
    </span>
  );
}
