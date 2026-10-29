import { useTranslation } from 'react-i18next';
import { useLocalizedNavigate } from '../hooks/useLocalizedNavigate';

/**
 * Pied de page global. Extrait d'App.tsx pour pouvoir utiliser la
 * navigation localisée (le lien "Mentions légales" doit pointer vers
 * /legal ou /de/legal selon la langue active).
 */
export default function SiteFooter() {
  const { t } = useTranslation();
  const navigate = useLocalizedNavigate();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <img src="/favicon.svg" alt="Drapeau Suisse" className="logo-icon" style={{ width: '26px', height: '26px', flexShrink: 0 }} />
          <span><span className="logo-red-letter">S</span>wiss<span className="logo-red-letter">S</span>imple</span>
        </div>
        <p className="disclaimer">
          {t('footer.copyright')} <br/>
          {t('footer.disclaimer')}<br/>
          {/* href réel pour "clic milieu / ouvrir dans un onglet", mais
              navigation SPA (et localisée) au clic normal */}
          <a
            href="/legal"
            onClick={(e) => {
              e.preventDefault();
              navigate('/legal');
            }}
            style={{ color: '#94A3B8', textDecoration: 'underline', marginTop: '10px', display: 'inline-block' }}
          >
            {t('footer.legal_link')}
          </a>
        </p>
      </div>
    </footer>
  );
}
