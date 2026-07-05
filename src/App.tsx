import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';

// Imports Composants Globaux
import GlobalToolbar from './components/GlobalToolbar';
import GlobalNavbar from './components/GlobalNavbar'; // <-- AJOUT DU MENU GLOBAL
import ScrollToTop from './components/ScrollToTop';

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
      {/* La route par défaut est la Landing Page publique */}
      <Route path="/" element={<Home />} />
      
      {/* Super Modules (Hubs) */}
      <Route path="/demenagement" element={<DemenagementHub />} />
      <Route path="/retraite" element={<RetraiteHub />} />

      {/* Page Légale */}
      <Route path="/legal" element={<Legal />} /> 

      {/* Les outils individuels restent accessibles */}
      <Route path="/radar-fiscal" element={<RadarFiscal />} />
      <Route path="/assurance" element={<Assurance />} />
      <Route path="/simulateur-avs" element={<SimulateurAVS />} />
      <Route path="/simulateur-lpp" element={<SimulateurLPP />} />
      
      {/* Le Dashboard n'est accessible que si on est connecté */}
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
      
      {/* Redirection par défaut */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  const { t } = useTranslation();

  return (
    <BrowserRouter>
      {/* LA BARRE GLOBALE (Langue + Connexion) */}
      <GlobalToolbar />
      
      {/* LE MENU GLOBAL (Logo + 4 Modules) */}
      <GlobalNavbar />
      
      {/* FORCE LE SCROLL EN HAUT À CHAQUE CHANGEMENT DE PAGE */}
      <ScrollToTop />
      
      {/* CONTENEUR PRINCIPAL qui pousse le footer vers le bas */}
      {/* On garde la marge ici pour TOUTES les pages */}
      <div style={{ minHeight: '80vh', paddingTop: '110px' }}>
        <AppRoutes />
      </div>

      {/* LE FOOTER GLOBAL (Sur toutes les pages) */}
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

    </BrowserRouter>
  );
}

export default App;