import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App.tsx';
import { getInitialTheme } from './stores/themeStore';

// Apply the theme before first paint to avoid a flash.
document.documentElement.setAttribute('data-theme', getInitialTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
