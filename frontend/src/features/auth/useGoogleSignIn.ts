import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { GoogleSignInCancelled, googleSignInEnabled, requestGoogleAccessToken } from '../../services/googleAuth';
import { toAppError } from '../../services/errors';

/** "Continue with Google": Google popup → our API → signed in. Closing the popup is not an error. */
export function useGoogleSignIn(onSignedIn: () => void, remember = true) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    if (!googleSignInEnabled) {
      setError('Google sign-in is not set up yet. Please use your email and password.');
      return;
    }
    setBusy(true);
    try {
      const token = await requestGoogleAccessToken();
      await loginWithGoogle(token, remember);
      onSignedIn();
    } catch (err) {
      if (!(err instanceof GoogleSignInCancelled)) {
        setError(toAppError(err, 'Google sign-in failed. Please try again.').message);
      }
    } finally {
      setBusy(false);
    }
  };

  return { start, busy, error };
}
