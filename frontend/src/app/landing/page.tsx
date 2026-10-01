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

export const metadata: Metadata = {
  title: 'Bentifiles: solicite documentos, valide a legibilidade e aprove',
  description:
    'Solicite documentos aos seus clientes, acompanhe os envios em tempo real e valide automaticamente a legibilidade de cada arquivo. 10 dias de teste no plano Individual.',
};

export default function LandingPage() {
  return (
    <>
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
