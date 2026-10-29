import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Synchronisation URL <-> langue. Monté à l'intérieur du BrowserRouter.
 *
 * 1. L'URL est la source de vérité : /de/... => interface allemande,
 *    tout le reste => français. Googlebot n'a ni localStorage ni cookies :
 *    il voit donc toujours la bonne langue sur la bonne URL.
 * 2. Met à jour <html lang="..."> (accessibilité + SEO).
 * 3. Un visiteur qui avait choisi l'allemand lors d'une visite précédente
 *    et qui atterrit sur la racine "/" est redirigé vers "/de" (on garde
 *    son choix en mémoire). Le crawler, lui, n'a pas de localStorage et
 *    n'est jamais redirigé : "/" reste toujours la version française.
 */
export default function LangSync() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  useEffect(() => {
    const isDe = pathname === '/de' || pathname.startsWith('/de/');
    const target = isDe ? 'de' : 'fr';

    // (3) D'ABORD : redirection du visiteur "allemand" atterrissant sur "/".
    //     On lit le choix mémorisé avant de l'écraser plus bas.
    if (pathname === '/' && !isDe) {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem('app_language');
      } catch {
        /* navigation privée : on ignore */
      }
      if (saved === 'de') {
        navigate('/de', { replace: true });
        return; // l'effet relancera sur /de et configurera la langue
      }
    }

    // (1) La langue suit l'URL
    if (i18n.language !== target) {
      i18n.changeLanguage(target);
    }

    // (2) <html lang> suit l'URL
    document.documentElement.lang = target;

    // Mémorisation du choix (utilisée uniquement pour la redirection (3))
    try {
      localStorage.setItem('app_language', target);
    } catch {
      /* navigation privée : on ignore */
    }
  }, [pathname, i18n, navigate]);

  return null;
}
