import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import de from './locales/de.json';

// On lit la langue sauvegardée dans le navigateur. Si vide, on met 'fr'.
const savedLanguage = localStorage.getItem('app_language') || 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      de: { translation: de },
    },
    lng: savedLanguage, // On force la langue sauvegardée au chargement
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;