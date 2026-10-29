import { useState, useEffect } from 'react';
import { useLocalizedNavigate } from '../hooks/useLocalizedNavigate';
import { useTranslation } from 'react-i18next';
import './GlobalNavbar.css';

export default function GlobalNavbar() {
  // Navigation localisée : ajoute automatiquement le préfixe /de
  // quand l'interface est en allemand (les URLs /de/... restent ainsi
  // cohérentes pendant toute la navigation).
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="nav-container">
<div className="nav-logo" onClick={() => navigate('/')}>
  <img src="/favicon.svg" alt="Drapeau Suisse" className="logo-icon" style={{ width: '26px', height: '26px', flexShrink: 0 }} />
  <span><span className="logo-red-letter">S</span>wiss<span className="logo-red-letter">S</span>imple</span>
</div>
        <div className="nav-links">
          <button className="nav-link-btn" onClick={() => navigate('/radar-fiscal')}>{t('nav.impots')}</button>
          <button className="nav-link-btn" onClick={() => navigate('/assurance')}>{t('nav.assurance')}</button>
          <button className="nav-link-btn" onClick={() => navigate('/simulateur-avs')}>{t('nav.avs')}</button>
          <button className="nav-link-btn" onClick={() => navigate('/simulateur-lpp')}>{t('nav.lpp')}</button>
        </div>
      </div>
    </nav>
  );
}