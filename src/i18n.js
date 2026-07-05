import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import de from './locales/de.json';

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    de: { translation: de }
  },
  lng: 'fr', // Langue par défaut
  fallbackLng: 'fr', // Si une traduction manque, on utilise le français
  interpolation: {
    escapeValue: false // React gère déjà la sécurité
  }
});

export default i18n;