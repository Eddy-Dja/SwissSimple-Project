import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import { useLocalizedNavigate } from '../hooks/useLocalizedNavigate';
import './GlobalToolbar.css';

const GlobalToolbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const rawNavigate = useNavigate();      // navigation brute (changement de langue)
  const navigate = useLocalizedNavigate(); // navigation localisée (bouton retour)
  const location = useLocation();

  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleLanguage = () => {
    // Le bouton DE/FR change maintenant D'URL : /quelquechose <-> /de/quelquechose.
    // C'est LangSync qui ajuste ensuite la langue affichée (l'URL est la
    // source de vérité). Résultat : chaque langue a une URL partageable
    // et indexable par Google (hreflang).
    const { pathname, search, hash } = location;
    const isDe = pathname === '/de' || pathname.startsWith('/de/');
    if (isDe) {
      // /de/radar-fiscal -> /radar-fiscal   (et /de -> /)
      rawNavigate((pathname.slice(3) || '/') + search + hash);
    } else {
      // /radar-fiscal -> /de/radar-fiscal   (et / -> /de)
      rawNavigate((pathname === '/' ? '/de' : `/de${pathname}`) + search + hash);
    }
  };

  // Accueil FR ("/") ou DE ("/de") : pas de bouton retour sur cette page
  const isHome = location.pathname === '/' || location.pathname === '/de';

  // Fonction pour ouvrir la messagerie avec une demande de suppression pré-remplie
  const handleDeleteAccount = () => {
    const userEmail = user?.email || 'inconnu';
    const subject = i18n.language === 'fr' ? 'Demande de suppression de compte' : 'Anfrage zur Kontolöschung';
    const body = i18n.language === 'fr' 
      ? `Bonjour,\n\nJe souhaite supprimer mon compte SwissSimple associé à l'adresse : ${userEmail}.\n\nCordialement.`
      : `Hallo,\n\nich möchte mein SwissSimple-Konto, das mit der Adresse ${userEmail} verknüpft ist, löschen.\n\nMit freundlichen Grüßen.`;
    
    // Remplace 'ton.email@exemple.ch' par l'adresse où tu veux recevoir ces demandes
    window.location.href = `mailto:ton.email@exemple.ch?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <>
      <div className="global-toolbar">
        {!isHome && (
          <div className="toolbar-left">
            <button className="toolbar-btn back-btn-global" onClick={() => navigate('/')}>
              ← {t('hub.back')}
            </button>
          </div>
        )}

        <div className="toolbar-right">
          <button className="toolbar-btn dark-toggle-btn" onClick={() => setIsDark(!isDark)}>
            {isDark ? '☀️' : '🌙'}
          </button>

          <button className="toolbar-btn" onClick={toggleLanguage}>
            {i18n.language === 'fr' ? 'DE' : 'FR'}
          </button>

          {user ? (
            // Si connecté, on affiche Déconnexion et Supprimer
            <>
              <button className="toolbar-btn auth-btn" onClick={() => signOut()}>
                {t('nav.logout')}
              </button>
              <button className="toolbar-btn delete-btn" onClick={handleDeleteAccount} title="Supprimer mon compte">
                🗑️
              </button>
            </>
          ) : (
            <button className="toolbar-btn auth-btn" onClick={() => setIsAuthModalOpen(true)}>
              {t('nav.login')}
            </button>
          )}
        </div>
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};

export default GlobalToolbar;