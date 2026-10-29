import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';
import { useState, useEffect, lazy, Suspense } from 'react';

// Imports Composants Globaux
import GlobalToolbar from './components/GlobalToolbar';
import GlobalNavbar from './components/GlobalNavbar';
import ScrollToTop from './components/ScrollToTop';
import AuthModal from './components/AuthModal';

// Home reste EAGER : c'est la page d'atterrissage.
// La charger en différé provoquerait un flash blanc juste après le loader.
import Home from './pages/Home';

// ============================================================
// CODE-SPLITTING : chaque page/module devient un chunk séparé,
// téléchargé uniquement quand l'utilisateur visite la route.
// ============================================================
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DemenagementHub = lazy(() => import('./pages/DemenagementHub'));
const RetraiteHub = lazy(() => import('./pages/RetraiteHub'));
const Legal = lazy(() => import('./pages/Legal'));
const RadarFiscal = lazy(() => import('./modules/fiscal/RadarFiscal'));
const Assurance = lazy(() => import('./modules/assurance_maladie/Assurance'));
const SimulateurAVS = lazy(() => import('./modules/rente_avs/SimulateurAVS'));
const SimulateurLPP = lazy(() => import('./modules/rente_lpp/SimulateurLPP'));
const Classements = lazy(() => import('./modules/classements/Classements'));

import './DarkMode.css';

// ============================================================
// SAUT VERS LES ANCRES (#xxx) APRÈS NAVIGATION INTERNE
// Ex: /radar-fiscal#copilot -> atterrit directement sur le widget
// Monté DANS le BrowserRouter (il a besoin de useLocation).
// ============================================================
function ScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // 100 ms : laisser la page se monter avant de chercher l'élément
      const timer = setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hash]);
  return null;
}

// Attente pendant le chargement d'un chunk (~100-500 ms) — inline, zéro CSS
function RouteChunkFallback() {
  const { i18n } = useTranslation();
  const isDe = i18n.language.startsWith('de');
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: '#94A3B8', fontSize: '14px' }}>
      {isDe ? 'Laden…' : 'Chargement…'}
    </div>
  );
}

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
  const { recoveryMode, setRecoveryMode, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // --- SUPPRESSION DU LOADER UNE FOIS L'APP MONTÉE ---
  useEffect(() => {
    const win = window as unknown as { swissLoadingInterval?: ReturnType<typeof setInterval> };
    if (win.swissLoadingInterval) clearInterval(win.swissLoadingInterval);

    const progressBar = document.getElementById('progress-fill');
    if (progressBar) progressBar.style.width = '100%';

    const initialLoader = document.getElementById('initial-loader');
    if (initialLoader) {
      setTimeout(() => {
        initialLoader.style.opacity = '0';
        setTimeout(() => {
          initialLoader.remove();
        }, 400);
      }, 300); // Le temps que l'œil voie la barre à 100%
    }
  }, []);
  // --------------------------------------------------

  useEffect(() => {
    if (recoveryMode) {
      setIsAuthModalOpen(true);
    }
  }, [recoveryMode]);

  return (
    <BrowserRouter>
      <GlobalToolbar />
      <GlobalNavbar />
      <ScrollToHash />      {/* saute aux ancres (#copilot) */}
      <ScrollToTop />        {/* remonte en haut */}

      <div style={{ minHeight: '80vh', paddingTop: '110px' }}>
        <Suspense fallback={<RouteChunkFallback />}>
          <AppRoutes />
        </Suspense>
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

          if (recoveryMode) {
            signOut();
            setRecoveryMode(false);
          }

          if (window.location.href.includes('type=recovery')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }}
      />

    </BrowserRouter>
  );
}

export default App;