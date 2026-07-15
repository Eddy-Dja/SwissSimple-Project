import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './i18n';
import './index.css'; // <--- LIGNE MANQUANTE AJOUTÉE ICI
import { HelmetProvider } from 'react-helmet-async';
import './DarkMode.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
   <HelmetProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>
);