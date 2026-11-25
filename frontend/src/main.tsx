import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App, { preloadPublicPage } from './App.tsx';
import { getInitialTheme } from './stores/themeStore';

// Apply the theme before first paint to avoid a flash.
document.documentElement.setAttribute('data-theme', getInitialTheme());

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
