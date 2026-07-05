import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function GlobalNavbar() {
  const navigate = useNavigate();
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
          <img src="/favicon.svg" alt="Drapeau Suisse" className="logo-icon" />
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