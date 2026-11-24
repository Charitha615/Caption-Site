import React, { useEffect, useId, useState } from 'react';
import { CheckCircle2, Clock, EyeOff, MessageSquareHeart, Trash2 } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { StarRating } from '../../components/ui/StarRating/StarRating';
import { reviewService, type OwnReview } from '../../services/reviewService';
import { fieldError, toAppError, type AppError } from '../../services/errors';
import { useToastStore } from '../../stores/toastStore';
import { useBrand } from '../../hooks/useBrand';
import './ReviewCard.css';

const MAX = 300;
const MIN = 10;

const STATUS = {
  pending: { icon: Clock, text: 'Waiting for approval — it appears on the sign-in page once approved.', tone: 'is-pending' },
  approved: { icon: CheckCircle2, text: 'Published — thank you! It is shown on the sign-in and sign-up pages.', tone: 'is-approved' },
  rejected: { icon: EyeOff, text: 'Not published. You can edit it and send it again.', tone: 'is-rejected' },
} as const;

/** "Rate Sinsub": the user's own review, shown publicly after approval. */
export function ReviewCard() {
  const brand = useBrand();
  const id = useId();
  const addToast = useToastStore((s) => s.addToast);
  const [review, setReview] = useState<OwnReview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    let active = true;
    reviewService.mine()
      .then((r) => {
        if (!active) return;
        setReview(r);
        if (r) {
          setRating(r.rating);
          setBody(r.body);
          setRole(r.role ?? '');
        }
      })
      .catch(() => undefined)
      .finally(() => active && setLoaded(true));
    return () => { active = false; };
  }, []);

  const unchanged = !!review && review.rating === rating && review.body === body.trim() && (review.role ?? '') === role.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate here instead of disabling the button, so the user sees what is missing.
    const fieldErrors: Record<string, string[]> = {};
    if (rating === 0) fieldErrors.rating = ['Pick a star rating.'];
    if (body.trim().length < MIN) fieldErrors.body = [`Write at least ${MIN} characters.`];
    if (Object.keys(fieldErrors).length) {
      setError({ status: null, code: 'validation', message: 'Please complete your review.', fieldErrors });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await reviewService.save({ rating, body: body.trim(), role: role.trim() || undefined });
      setReview(saved);
      addToast({ type: 'success', message: 'Thanks! Your review will appear once it is approved.' });
    } catch (err) {
      setError(toAppError(err, 'Could not save your review.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await reviewService.remove();
      setReview(null);
      setRating(0);
      setBody('');
      setRole('');
      addToast({ type: 'info', message: 'Your review was deleted.' });
    } catch (err) {
      setError(toAppError(err, 'Could not delete your review.'));
    } finally {
      setSaving(false);
    }
  };

  const clearField = (field: string) =>
    setError((prev) => {
      if (!prev?.fieldErrors[field]) return prev;
      const { [field]: _removed, ...rest } = prev.fieldErrors;
      return Object.keys(rest).length ? { ...prev, fieldErrors: rest } : null;
    });

  const status = review ? STATUS[review.status] : null;

  return (
    <section className="profile-card review-card" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="profile-card-title"><MessageSquareHeart size={18} aria-hidden="true" /> Rate {brand.name}</h3>
      <p className="profile-card-sub">Tell other creators what you think. Approved reviews are shown on the sign-in and sign-up pages with your name.</p>

      {status && (
        <p className={`review-status ${status.tone}`}>
          <status.icon size={16} aria-hidden="true" /> {status.text}
        </p>
      )}

      {loaded && (
        <form className="review-form" onSubmit={save} noValidate>
          {error && !Object.keys(error.fieldErrors).length && <div className="form-alert" role="alert">{error.message}</div>}

          <div className="review-field">
            <span className="review-label" id={`${id}-rating`}>Your rating</span>
            <div aria-labelledby={`${id}-rating`}>
              <StarRating value={rating} onChange={(v) => { setRating(v); clearField('rating'); }} label="Your rating" />
            </div>
            {fieldError(error, 'rating') && <p className="review-error" role="alert">{fieldError(error, 'rating')}</p>}
          </div>

          <div className="review-field">
            <label className="review-label" htmlFor={`${id}-body`}>Your review</label>
            <textarea
              id={`${id}-body`}
              className="input-field review-textarea"
              rows={3}
              maxLength={MAX}
              lang="si"
              placeholder="e.g. Captioning my vlogs is so much faster now — and English words come out right!"
              value={body}
              onChange={(e) => { setBody(e.target.value); if (e.target.value.trim().length >= MIN) clearField('body'); }}
              aria-describedby={`${id}-count`}
            />
            <div className="review-meta">
              {fieldError(error, 'body') ? <span className="review-error" role="alert">{fieldError(error, 'body')}</span> : <span />}
              <span id={`${id}-count`} className="review-count">
                {body.trim().length < MIN ? `At least ${MIN} characters · ` : ''}{body.length}/{MAX}
              </span>
            </div>
          </div>

          <div className="review-field">
            <label className="review-label" htmlFor={`${id}-role`}>What you do <span className="review-optional">(optional)</span></label>
            <input
              id={`${id}-role`}
              className="input-field"
              maxLength={80}
              placeholder="e.g. Travel vlogger · 20K subscribers"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>

          <div className="review-actions">
            <Button type="submit" variant="primary" isLoading={saving} disabled={unchanged}>
              {review ? 'Update review' : 'Submit review'}
            </Button>
            {review && (
              <Button type="button" variant="ghost" onClick={() => void remove()} disabled={saving} startIcon={<Trash2 size={16} aria-hidden="true" />}>
                Delete
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
