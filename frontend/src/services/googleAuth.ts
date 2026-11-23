/**
 * "Continue with Google" via Google Identity Services (token model): opens Google's
 * account picker in a popup and returns an OAuth access token, which the backend then
 * verifies with Google before signing the user in.
 */
const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface TokenResponse { access_token?: string; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (overrides?: { prompt?: string }) => void }
interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => TokenClient;
}
declare global {
  interface Window { google?: { accounts?: { oauth2?: GoogleOAuth2 } } }
}

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
export const googleSignInEnabled = GOOGLE_CLIENT_ID !== '';

/** Thrown when the user closes the Google popup — not an error worth showing. */
export class GoogleSignInCancelled extends Error {}

let loading: Promise<GoogleOAuth2> | null = null;

function loadGis(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  loading ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error('Google sign-in could not load.')));
    script.onerror = () => {
      loading = null;
      reject(new Error('Google sign-in could not load. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Opens Google's sign-in popup and resolves with an access token. */
export async function requestGoogleAccessToken(): Promise<string> {
  if (!googleSignInEnabled) throw new Error('Google sign-in is not set up yet.');
  const oauth2 = await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error_description || 'Google sign-in was not completed.'));
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed' || error.type === 'popup_failed_to_open') {
          reject(error.type === 'popup_closed' ? new GoogleSignInCancelled() : new Error('Allow pop-ups for this site to continue with Google.'));
        } else {
          reject(new Error(error.message || 'Google sign-in failed.'));
        }
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}
