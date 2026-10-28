import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

interface SEOProps {
  /** Titre de l'onglet + partages (~65 car. max) */
  title: string;
  /** Description pour Google (~155 car. max) */
  description: string;
  /** Chemin de la page, ex. '/assurance' — pour l'URL canonique */
  path?: string;
}

const SITE_URL = 'https://swisssimple.ch';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export default function SEO({ title, description, path = '' }: SEOProps) {
  const { i18n } = useTranslation();
  const url = `${SITE_URL}${path}`;
  const locale = i18n.language === 'de' ? 'de_CH' : 'fr_CH';

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="SwissSimple" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={locale} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
    </Helmet>
  );
}