import { BRAND } from '../../config/brand';
import { MarketingFooter, MarketingHeader } from './MarketingChrome';

/** When the policy text last changed (YYYY-MM-DD). Update it whenever you edit the text below. */
export const PRIVACY_UPDATED = '2026-11-27';

const updatedLabel = new Date(`${PRIVACY_UPDATED}T00:00:00Z`).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

/** Privacy policy: what the app stores, who processes it, and how users control it. */
export function PrivacyPage() {
  const email = BRAND.supportEmail;
  const mail = <a href={`mailto:${email}`}>{email}</a>;
  return (
    <div className="landing">
      <a href="#main" className="skip-link">Skip to content</a>
      <MarketingHeader />
      <main id="main">
        <article>
          <header className="mk-hero">
            <div className="sx-wrap mk-narrow">
              <p className="sx-kicker">Legal</p>
              <h1 className="mk-h1">Privacy Policy</h1>
              <p className="mk-intro">
                This policy explains what {BRAND.name} collects when you use {BRAND.domain}, why, and the choices you have.
              </p>
              <div className="mk-hero-actions">
                <span className="mk-updated">Updated <time dateTime={PRIVACY_UPDATED}>{updatedLabel}</time></span>
              </div>
            </div>
          </header>

          <div className="sx-wrap mk-narrow mk-body">
            <section className="mk-section">
              <h2 className="mk-h2">What we collect</h2>
              <ul className="mk-list">
                <li><strong>Account details:</strong> your name, email address and a securely hashed password. If you sign in with Google, we receive your name, email address and profile picture from Google.</li>
                <li><strong>Your content:</strong> the videos you upload, and the transcripts, captions, styles and exports created from them.</li>
                <li><strong>Your Gemini API key</strong>, if you add one. It is stored encrypted and used only to caption your own videos.</li>
                <li><strong>Usage records:</strong> caption minutes and AI requests used, to apply plan limits.</li>
                <li><strong>Technical logs:</strong> IP address, browser and request details, kept to keep the service secure and to fix errors.</li>
                <li><strong>Signed-in devices:</strong> for each sign-in, the browser and device type, the IP address and the time, so you can see and sign out your devices in Settings. They are deleted when that device signs out or its sign-in expires.</li>
              </ul>
            </section>

            <section className="mk-section">
              <h2 className="mk-h2">How we use it</h2>
              <ul className="mk-list">
                <li>To create and secure your account and let you sign in, including with Google.</li>
                <li>To transcribe, caption, edit and export your videos.</li>
                <li>To apply plan limits, prevent abuse and keep the service running.</li>
                <li>To reply when you contact us.</li>
              </ul>
              <p className="mk-p">We do not sell your data, show ads or use your videos to train our own AI models.</p>
            </section>

            <section className="mk-section">
              <h2 className="mk-h2">Google sign-in</h2>
              <p className="mk-p">
                When you choose “Continue with Google”, we only use your basic profile (name, email address and profile picture) to create your account and sign you in.
                We do not access your Gmail, Drive, contacts or any other Google data. Our use of information received from Google APIs follows the{' '}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">Google API Services User Data Policy</a>,
                including the Limited Use requirements.
              </p>
            </section>

            <section className="mk-section">
              <h2 className="mk-h2">Services that process your data</h2>
              <ul className="mk-list">
                <li><strong>Google Gemini:</strong> the audio of your videos is sent to Google’s Gemini API to produce the transcript and captions.</li>
                <li><strong>Hosting providers:</strong> our servers and storage, where your account and files are kept.</li>
                <li><strong>Google Identity Services:</strong> only if you sign in with Google.</li>
              </ul>
            </section>

            <section className="mk-section">
              <h2 className="mk-h2">Storage and deletion</h2>
              <ul className="mk-list">
                <li>Uploaded videos and exports are stored privately and are only available to you through short-lived signed links.</li>
                <li>When you delete a project, its video, captions and exports are deleted with it.</li>
                <li>To delete your whole account and everything in it, email {mail} from the address on your account. We complete deletion within 30 days.</li>
              </ul>
            </section>

            <section className="mk-section">
              <h2 className="mk-h2">Your choices</h2>
              <p className="mk-p">
                You can update your name, password and Gemini API key in your account settings, and download your captions at any time.
                You can also ask us for a copy of your data, or to correct or delete it, by emailing {mail}.
              </p>
            </section>

            <section className="mk-section">
              <h2 className="mk-h2">Cookies</h2>
              <p className="mk-p">We only use what is needed to keep you signed in and remember your settings. We do not use advertising or tracking cookies.</p>
            </section>

            <section className="mk-section">
              <h2 className="mk-h2">Changes and contact</h2>
              <p className="mk-p">
                If this policy changes, we will update the date at the top of this page. Questions about your privacy? Email {mail}.
              </p>
            </section>
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
