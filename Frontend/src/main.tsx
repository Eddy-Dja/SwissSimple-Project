import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './i18n';
import './index.css';
import { HelmetProvider } from 'react-helmet-async';
import './DarkMode.css';

// Estampille de build — valeurs injectées par vite.config.ts (define)
declare const __BUILD_SHA__: string
declare const __BUILD_DATE__: string

console.info(`SwissSimple — build ${__BUILD_SHA__} du ${__BUILD_DATE__} UTC`);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
   <HelmetProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>
);