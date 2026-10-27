import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App.tsx';

// Initialize theme immediately to prevent flashing
const initialTheme = localStorage.getItem('samplecap_theme') || 'dark';
document.documentElement.setAttribute('data-theme', initialTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
