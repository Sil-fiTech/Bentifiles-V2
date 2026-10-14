import type { Metadata } from 'next';
import LandingHeader from './components/LandingHeader';
import HeroSection from './components/HeroSection';
import ValidationSection from './components/ValidationSection';
import StepsSection from './components/StepsSection';
import ResourcesSection from './components/ResourcesSection';
import PricingSection from './components/PricingSection';
import FaqSection from './components/FaqSection';
import ClosingSection from './components/ClosingSection';
import LandingFooter from './components/LandingFooter';
import LandingJsonLd from './components/LandingJsonLd';
import { openGraphFor } from '@/lib/seo';

const title = 'Bentifiles: solicite documentos e valide a legibilidade';
const description =
  'Peça documentos aos seus clientes, acompanhe quem já enviou e valide a legibilidade de cada arquivo antes de abrir. 10 dias de teste no plano Individual.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  // A landing é servida em "/" (ver rewrites em next.config.ts); "/landing" redireciona para lá.
  alternates: { canonical: '/' },
  openGraph: openGraphFor({ title, description, path: '/' }),
};

export default function LandingPage() {
  return (
    <>
      <LandingJsonLd description={description} />
      <LandingHeader />
      <main>
        <HeroSection />
        <ValidationSection />
        <StepsSection />
        <ResourcesSection />
        <PricingSection />
        <FaqSection />
        <ClosingSection />
      </main>
      <LandingFooter />
    </>
  );
}
