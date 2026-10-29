import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Navigation localisée : préfixe automatiquement les chemins avec "/de"
 * quand l'interface est en allemand.
 *
 * Exemples (langue DE active) :
 *   lp('/radar-fiscal')        -> /de/radar-fiscal
 *   lp('/radar-fiscal#copilot')-> /de/radar-fiscal#copilot
 *   lp('/')                    -> /de
 *
 * En français, les chemins sont utilisés tels quels.
 */
export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isDe = i18n.language?.startsWith('de') ?? false;

  return (path: string) => {
    // Normalisation : '/' devient '' (pour éviter "/de/"), on garantit
    // un slash initial sur les autres chemins.
    const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
    navigate(isDe ? `/de${clean}` : clean || '/');
  };
}
