import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';
import { useState, useEffect } from 'react';
import Classements from './modules/classements/Classements';

// Imports Composants Globaux
import GlobalToolbar from './components/GlobalToolbar';
import GlobalNavbar from './components/GlobalNavbar';
import ScrollToTop from './components/ScrollToTop';
import AuthModal from './components/AuthModal';

// Imports Pages
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import DemenagementHub from './pages/DemenagementHub';
import RetraiteHub from './pages/RetraiteHub';
import Legal from './pages/Legal';

// Imports Modules
import RadarFiscal from './modules/fiscal/RadarFiscal';
import Assurance from './modules/assurance_maladie/Assurance';
import SimulateurAVS from './modules/rente_avs/SimulateurAVS';
import SimulateurLPP from './modules/rente_lpp/SimulateurLPP';

import './DarkMode.css';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/demenagement" element={<DemenagementHub />} />
      <Route path="/retraite" element={<RetraiteHub />} />
      <Route path="/legal" element={<Legal />} /> 
      <Route path="/radar-fiscal" element={<RadarFiscal />} />
      <Route path="/assurance" element={<Assurance />} />
      <Route path="/simulateur-avs" element={<SimulateurAVS />} />
      <Route path="/simulateur-lpp" element={<SimulateurLPP />} />
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
      <Route path="*" element={<Navigate to="/" />} />
      <Route path="/classements" element={<Classements />} />
    </Routes>
  );
}

function App() {
  const { t } = useTranslation();
  const { recoveryMode, setRecoveryMode, signOut } = useAuth(); // AJOUT de signOut
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (recoveryMode) {
      setIsAuthModalOpen(true);
    }
  }, [recoveryMode]);

  return (
    <BrowserRouter>
      <GlobalToolbar />
      <GlobalNavbar />
      <ScrollToTop />
      
      <div style={{ minHeight: '80vh', paddingTop: '110px' }}>
        <AppRoutes />
      </div>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <img src="/favicon.svg" alt="Drapeau Suisse" className="logo-icon" style={{ width: '26px', height: '26px', flexShrink: 0 }} />
            <span><span className="logo-red-letter">S</span>wiss<span className="logo-red-letter">S</span>imple</span>
          </div>
          <p className="disclaimer">
            {t('footer.copyright')} <br/>
            {t('footer.disclaimer')}<br/>
            <a href="/legal" style={{ color: '#94A3B8', textDecoration: 'underline', marginTop: '10px', display: 'inline-block' }}>
              {t('footer.legal_link')}
            </a>
          </p>
        </div>
      </footer>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        forceUpdateMode={recoveryMode} 
        onClose={() => { 
          setIsAuthModalOpen(false); 
          
          // Si on fermait la fenêtre de récupération de mot de passe, on détruit la session temporaire !
          if (recoveryMode) {
            signOut();
            setRecoveryMode(false);
          }

          // Nettoie l'URL des paramètres de récupération
          if (window.location.href.includes('type=recovery')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }} 
      />

    </BrowserRouter>
  );
}

export default App;