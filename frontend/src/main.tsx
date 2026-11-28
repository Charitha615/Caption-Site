import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App, { preloadPublicPage } from './App.tsx';
import { getInitialTheme } from './stores/themeStore';
import { captureAttribution } from './utils/attribution';

// Apply the theme before first paint to avoid a flash.
document.documentElement.setAttribute('data-theme', getInitialTheme());

// Remember where this visitor came from (UTM tags / referring site) for sign-up attribution.
captureAttribution();

const root = document.getElementById('root')!;

/** Public pages arrive prerendered; load that page's screen first so the app replaces it without a loading flash. */
const ready = root.firstElementChild ? preloadPublicPage(window.location.pathname).catch(() => undefined) : Promise.resolve();

void ready.then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
