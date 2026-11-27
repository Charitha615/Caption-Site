import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor } from 'lucide-react';

/** Phone-sized screens: narrow in portrait, or short in landscape. Tablets and computers are larger. */
export const PHONE_QUERY = '(max-width: 699px), (max-height: 499px) and (max-width: 950px)';
const DISMISSED_KEY = 've-phone-notice-dismissed';

const isPhone = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * On a phone, explains that the editor is made for tablets and computers. The person can still go on
 * ("Continue anyway", remembered for this visit), or go back to the dashboard.
 */
export function PhoneNotice() {
  const [phone, setPhone] = useState(isPhone);
  const [dismissed, setDismissed] = useState(wasDismissed);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (!phone || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private mode: the notice just comes back next time.
    }
    setDismissed(true);
  };

  return (
    <div className="ve-phone-notice" role="dialog" aria-modal="true" aria-labelledby="ve-phone-title">
      <div className="ve-phone-card">
        <Monitor size={36} aria-hidden="true" />
        <h2 id="ve-phone-title">The video editor works best on a bigger screen</h2>
        <p>Please open it on a tablet or a computer. A phone screen is too small for the timeline and tools.</p>
        <p lang="si">Video editor එක tablet එකක හෝ computer එකක open කරන්න. Phone screen එකේ timeline එකට සහ tools වලට ඉඩ මදි.</p>
        <p className="ve-phone-hint">On a tablet, turning it sideways (landscape) gives the most room.</p>
        <div className="ve-phone-actions">
          <Link to="/dashboard" className="ve-export">Back to dashboard</Link>
          <button type="button" className="ve-phone-continue" onClick={dismiss}>Continue anyway</button>
        </div>
      </div>
    </div>
  );
}
