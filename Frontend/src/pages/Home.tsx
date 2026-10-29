import { useLayoutEffect, useRef } from 'react';
import { useLocalizedNavigate } from '../hooks/useLocalizedNavigate';
import { useTranslation } from 'react-i18next';
import './Home.css';
import SEO from '../components/SEO';   // adapte le chemin relatif à l'emplacement du fichier

export default function Home() {
  // Navigation localisée : conserve le préfixe /de pour les visiteurs allemands
  const navigate = useLocalizedNavigate();
  const { t, i18n } = useTranslation();

  const handlePremiumClick = (path: string) => {
    navigate(path);
  };

  const scrollToPremium = () => {
    document.getElementById('premium-modules')?.scrollIntoView({ behavior: 'smooth' });
  };

  /* Ligne 2 du bloc confiance : la faire tenir sur UNE seule ligne dans
     toutes les langues (l'allemand est plus long que le français).
     On mesure la largeur réelle du texte et on réduit la police juste
     ce qu'il faut — texte inchangé, même nombre de lignes qu'en FR. */
  const trustWrapRef = useRef<HTMLDivElement>(null);
  const trustLineRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrap = trustWrapRef.current;
    const line = trustLineRef.current;
    if (!wrap || !line) return;

    const fit = () => {
      line.style.fontSize = '';                                // reset → taille CSS
      let size = parseFloat(getComputedStyle(line).fontSize);  // en px
      const min = size * 0.68;                                 // plancher : 68 %
      while (line.offsetWidth > wrap.clientWidth && size > min) {
        size -= 0.5;
        line.style.fontSize = `${size}px`;
      }
    };

    fit();                                        // avant le premier rendu visuel
    window.addEventListener('resize', fit);       // fenêtre redimensionnée
    if (document.fonts) document.fonts.ready.then(fit);  // webfonts chargées
    return () => window.removeEventListener('resize', fit);
  }, [i18n.language]);

  return (
    <div className="swiss-app">

  <SEO title={t('seo.home_title')} description={t('seo.home_desc')} path="/" />

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

            {/* BOUTON COPILOT — la 2e porte d'entrée (demander plutôt que calculer) */}
            <button className="btn-hero-copilot" onClick={() => navigate('/radar-fiscal#copilot')}>
              🤖 {t('hero.cta_copilot')}
            </button>

            <button className="btn-hero-secondary" onClick={scrollToPremium}>
              {t('hero.cta2')}
            </button>

            <button className="btn-hero-atlas" onClick={() => navigate('/classements')}>
              {t('hero.atlas_btn')}
            </button>
          </div>

          <div className="hero-trust">
            {/* Ligne 1 : sources officielles AFC + OFSP */}
            <span className="hero-trust-main">{t('hero.trust1')}</span>

            {/* Ligne 2 : une seule ligne dans toutes les langues (taille auto) */}
            <div className="hero-trust-secondary" ref={trustWrapRef}>
              <div className="hero-trust-line" ref={trustLineRef}>
                <span className="hero-trust-pair">
                  <span>{t('hero.trust2')}</span>
                  <span>{t('hero.trust3')}</span>
                </span>
                <span>🤖 {t('hero.trust4')}</span>
              </div>
            </div>
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
              <p>{t('free.desc_impots', 'Comparez votre charge fiscale entre communes : revenu, statut, enfants et déductions.')}</p>
              <span className="tool-cta">→</span>
            </div>

            <div className="tool-card" onClick={() => navigate('/assurance')}>
              <div className="tool-icon-wrap green-icon">🏥</div>
              <h3>{t('nav.assurance')}</h3>
              <p>{t('free.desc_assurance', 'Comparez les primes LAMal 2027 des assureurs de votre région, tous modèles et franchises.')}</p>
              <span className="tool-cta">→</span>
            </div>

            <div className="tool-card" onClick={() => navigate('/simulateur-avs')}>
              <div className="tool-icon-wrap orange-icon">🧓</div>
              <h3>{t('nav.avs')}</h3>
              <p>{t('free.desc_avs', 'Estimez votre rente de vieillesse 1er pilier : cotisations, splitting et 13e versement.')}</p>
              <span className="tool-cta">→</span>
            </div>

            <div className="tool-card" onClick={() => navigate('/simulateur-lpp')}>
              <div className="tool-icon-wrap purple-icon">🏦</div>
              <h3>{t('nav.lpp')}</h3>
              <p>{t('free.desc_lpp', 'Projetez votre 2e pilier : capital, rendement et rente à la retraite.')}</p>
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