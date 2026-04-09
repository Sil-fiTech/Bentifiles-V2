import type { Metadata } from 'next';
import LandingHeader from './components/LandingHeader';
import HeroSection from './components/HeroSection';
import BenefitsSection from './components/BenefitsSection';
import HowItWorksSection from './components/HowItWorksSection';
import FeaturesSection from './components/FeaturesSection';
import ImpactSection from './components/ImpactSection';
import FaqSection from './components/FaqSection';
import CtaSection from './components/CtaSection';
import LandingFooter from './components/LandingFooter';

export const metadata: Metadata = {
  title: 'Bentifiles — Centralize, Organize e Padronize seus Documentos',
  description:
    'O Bentifiles é uma plataforma de gestão de documentos, projetos e templates. Reduza o retrabalho e mantenha sua equipe alinhada com organização inteligente.',
};

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <HeroSection />
      <BenefitsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <ImpactSection />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
    </>
  );
}
