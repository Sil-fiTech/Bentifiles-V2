import { plans } from '../data/plans';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

// Dados estruturados para o Google. Preços e descrição vêm das mesmas fontes que a página exibe,
// para nunca divergirem do conteúdo visível.
export default function LandingJsonLd({ description }: { description: string }) {
  const offers = plans
    .filter((plan) => plan.monthlyPriceRaw !== undefined)
    .map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: (plan.monthlyPriceRaw as number).toFixed(2),
      priceCurrency: 'BRL',
      url: `${SITE_URL}/#planos`,
    }));

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Silfi-Tech',
        url: 'https://www.silfi-tech.net/',
        brand: { '@type': 'Brand', name: SITE_NAME },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE_URL}/#organization` },
        offers,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // `<` escapado para que nenhum texto dos dados feche a tag <script>.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
