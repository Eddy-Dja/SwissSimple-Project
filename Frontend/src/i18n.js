import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import de from './locales/de.json';

// Langue initiale : L'URL PRIME sur la préférence sauvegardée.
// - /de/...  -> allemand, dès le premier rendu (Googlebot voit ainsi
//   la bonne langue sur la bonne URL, sans flash de contenu FR)
// - sinon    -> préférence mémorisée, français par défaut.
// Le composant LangSync ajustera ensuite la langue à chaque navigation.
const isDeUrl =
  typeof window !== 'undefined' &&
  (window.location.pathname === '/de' || window.location.pathname.startsWith('/de/'));
const savedLanguage = isDeUrl ? 'de' : localStorage.getItem('app_language') || 'fr';

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