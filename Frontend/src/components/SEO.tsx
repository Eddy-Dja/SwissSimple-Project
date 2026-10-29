import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

interface SEOProps {
  /** Titre de l'onglet + partages (~65 car. max) */
  title: string;
  /** Description pour Google (~155 car. max) */
  description: string;
  /** Chemin FR de la page, ex. '/assurance' (SANS préfixe /de) — sert
   *  à construire l'URL canonique et les deux versions hreflang */
  path?: string;
}

const SITE_URL = 'https://swisssimple.ch';
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export default function SEO({ title, description, path = '/' }: SEOProps) {
  const { i18n } = useTranslation();
  const isDe = i18n.language?.startsWith('de') ?? false;

  // Chemin FR normalisé : '' pour la racine (évite swisssimple.ch//)
  const frPath = path === '/' ? '' : path;
  const frUrl = `${SITE_URL}${frPath}`;
  const deUrl = `${SITE_URL}/de${frPath}`;

  // Chaque version linguistique a SA propre URL canonique (règle Google
  // pour les sites multilingues) + les deux alternates hreflang.
  const canonical = isDe ? deUrl : frUrl;
  const locale = isDe ? 'de_CH' : 'fr_CH';

  return (
    <Helmet>
      <html lang={isDe ? 'de' : 'fr'} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* Versions linguistiques : fr (racine), de (/de/...), x-default = fr */}
      <link rel="alternate" hrefLang="fr" href={frUrl} />
      <link rel="alternate" hrefLang="de" href={deUrl} />
      <link rel="alternate" hrefLang="x-default" href={frUrl} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="SwissSimple" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="2400" />
      <meta property="og:image:height" content="1260" />
      <meta property="og:locale" content={locale} />
      <meta property="og:locale:alternate" content={isDe ? 'fr_CH' : 'de_CH'} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
    </Helmet>
  );
}
