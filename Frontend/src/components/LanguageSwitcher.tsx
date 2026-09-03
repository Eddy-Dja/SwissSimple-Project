import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'fr' ? 'de' : 'fr');
  };

  return (
    <button className="lang-switcher-btn" onClick={toggleLanguage}>
      {i18n.language === 'fr' ? 'DE' : 'FR'}
    </button>
  );
}