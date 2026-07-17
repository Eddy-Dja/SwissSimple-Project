import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Home.css';
import { Helmet } from 'react-helmet-async';

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handlePremiumClick = (path: string) => {
    navigate(path);
  };

  const scrollToPremium = () => {
    document.getElementById('premium-modules')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="swiss-app">
      
<Helmet>
  <title>SwissSimple | Simulateur Financier Suisse (Impôts, Retraite (AVS et LPP), Assurances)</title>
  <meta name="description" content="SwissSimple: Le simulateur financier suisse 100% gratuit. Calculez vos impôts, comparez votre assurance maladie et estimez votre retraite (AVS/LPP) dans tous les cantons." />
</Helmet>

      <header className="hero-section">
        <div className="hero-glow"></div>
        <div className="hero-container-simple">
          <div className="hero-badge">{t('hero.badge')}</div>
          <h1>
            {t('hero.title1')} <span className="text-gradient">{t('hero.title2')}</span>.
          </h1>
          <p className="hero-subtitle">
            {t('hero.subtitle')}
          </p>
          
          <div className="hero-cta-group">
            <button className="btn-hero-primary" onClick={() => navigate('/radar-fiscal')}>
              {t('hero.cta1')}
            </button>
            <button className="btn-hero-secondary" onClick={scrollToPremium}>
              {t('hero.cta2')}
            </button>
                        {/* NOUVEAU BOUTON POUR L'ATLAS */}
            <button className="btn-hero-secondary" onClick={() => navigate('/classements')}>
              📊 Atlas & Statistiques
            </button>
            </div>
          
          <div className="hero-trust">
            <span>{t('hero.trust1')}</span>
            <span>{t('hero.trust2')}</span>
            <span>{t('hero.trust3')}</span>
          </div>
        </div>
      </header>

      <section className="free-tools-section">
        <div className="container">
          <h2 className="section-title">{t('free.title')}</h2>
          <p className="section-subtitle">{t('free.subtitle')}</p>
          
          <div className="tools-grid">
            <div className="tool-card" onClick={() => navigate('/radar-fiscal')}>
              <div className="tool-icon-wrap blue-icon">💰</div>
              <h3>{t('nav.impots')}</h3>
              <p>{t('hero.subtitle')}</p>
              <span className="tool-cta">→</span>
            </div>

            <div className="tool-card" onClick={() => navigate('/assurance')}>
              <div className="tool-icon-wrap green-icon">🏥</div>
              <h3>{t('nav.assurance')}</h3>
              <p>{t('hero.subtitle')}</p>
              <span className="tool-cta">→</span>
            </div>

            <div className="tool-card" onClick={() => navigate('/simulateur-avs')}>
              <div className="tool-icon-wrap orange-icon">🧓</div>
              <h3>{t('nav.avs')}</h3>
              <p>{t('hero.subtitle')}</p>
              <span className="tool-cta">→</span>
            </div>

            <div className="tool-card" onClick={() => navigate('/simulateur-lpp')}>
              <div className="tool-icon-wrap purple-icon">🏦</div>
              <h3>{t('nav.lpp')}</h3>
              <p>{t('hero.subtitle')}</p>
              <span className="tool-cta">→</span>
            </div>
          </div>
        </div>
      </section>

      <section className="premium-section" id="premium-modules">
        <div className="premium-header">
          <h2>{t('premium.title')}</h2>
          <p>{t('premium.subtitle')}</p>
        </div>
        
        <div className="premium-grid">
          <div className="premium-card" onClick={() => handlePremiumClick('/demenagement')}>
            <div className="premium-badge"> {t('premium.badge')}</div>
            <div className="premium-icon">🖥️</div>
            <h3>{t('premium.demenagement_title')}</h3>
            <p>{t('premium.demenagement_desc')}</p>
            <button className="btn-premium">{t('premium.cta')}</button>
          </div>

          <div className="premium-card" onClick={() => handlePremiumClick('/retraite')}>
            <div className="premium-badge"> {t('premium.badge')}</div>
            <div className="premium-icon">👴</div>
            <h3>{t('premium.retraite_title')}</h3>
            <p>{t('premium.retraite_desc')}</p>
            <button className="btn-premium">{t('premium.cta')}</button>
          </div>
        </div>
      </section>

    </div>
  );
}