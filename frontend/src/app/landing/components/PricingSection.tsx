'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Zap,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { plans, billingFaqs } from '../data/plans';
import type { Plan } from '../data/plans';
import PricingCard from './PricingCard';
import styles from '../landing.module.scss';

// ─── Stripe integration hook-point ─────────────────────────────────────────
/**
 * handleSubscribe — called when user clicks "Assinar plano" on any card.
 *
 * To integrate with real Stripe Checkout:
 * 1. Create a Next.js API route at /api/stripe/checkout
 * 2. That route receives { priceId } and returns a Stripe Checkout Session URL
 * 3. Redirect the user to session.url
 *
 * Example:
 *   const res = await fetch('/api/stripe/checkout', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ priceId: plan.priceId }),
 *   });
 *   const { url } = await res.json();
 *   window.location.href = url;
 */
async function handleSubscribe(plan: Plan): Promise<void> {
  // TODO: replace this mock with a real call to /api/stripe/checkout
  console.log(`[Stripe] Initiating checkout for plan: ${plan.name} | priceId: ${plan.priceId}`);

  // Simulate async latency (remove in production)
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // When ready, uncomment and configure:
  // const res = await fetch('/api/stripe/checkout', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ priceId: plan.priceId }),
  // });
  // const { url } = await res.json();
  // window.location.href = url;
}

// ─── Value props ──────────────────────────────────────────────────────────
const valueProps = [
  {
    icon: <LayoutDashboard size={22} />,
    title: 'Centralização total',
    description: 'Todos os documentos, templates e projetos em um painel único e organizado.',
  },
  {
    icon: <Shield size={22} />,
    title: 'Padronização real',
    description: 'Templates e estruturas consistentes que eliminam retrabalho e erros.',
  },
  {
    icon: <Zap size={22} />,
    title: 'Produtividade elevada',
    description: 'Menos tempo procurando arquivos, mais tempo produzindo resultados.',
  },
  {
    icon: <Users size={22} />,
    title: 'Colaboração eficiente',
    description: 'Equipes alinhadas, com controle de acesso e visibilidade compartilhada.',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────
export default function PricingSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i);

  return (
    <>
      {/* ── Pricing Hero ──────────────────────────────────────── */}
      <section className={styles.pricingHero} id="planos">
        <div className={styles.pricingHeroOrb1} aria-hidden="true" />
        <div className={styles.pricingHeroOrb2} aria-hidden="true" />

        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionBadge}>Planos &amp; Preços</div>
            <h1 className={styles.sectionTitle}>
              Escolha o plano{' '}
              <span className={styles.sectionTitleAccent}>ideal para você</span>
            </h1>
            <p className={styles.sectionSubtitle}>
              Do profissional autônomo à grande empresa — temos o plano certo para cada perfil.
              Sem taxas ocultas. Cancele quando quiser.
            </p>
          </div>

          {/* Plan cards grid */}
          <div className={styles.pricingGrid}>
            {plans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} onSubscribe={handleSubscribe} />
            ))}
          </div>

          <p className={styles.pricingDisclaimer}>
            Pagamentos processados com segurança via{' '}
            <span className={styles.pricingDisclaimerStripe}>Stripe</span>.
            Todos os preços em BRL. Cobranças recorrentes mensais.
          </p>
        </div>
      </section>

      {/* ── Value Props ───────────────────────────────────────── */}
      <section className={styles.pricingValueProps}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader} style={{ marginBottom: '3rem' }}>
            <h2 className={styles.sectionTitle}>
              Por que o{' '}
              <span className={styles.sectionTitleAccent}>Bentifiles?</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              Uma plataforma feita para quem leva organização e produtividade a sério.
            </p>
          </div>

          <div className={styles.pricingValueGrid}>
            {valueProps.map((prop, i) => (
              <div key={i} className={styles.pricingValueCard}>
                <div className={styles.pricingValueIcon}>{prop.icon}</div>
                <h3 className={styles.pricingValueTitle}>{prop.title}</h3>
                <p className={styles.pricingValueDesc}>{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Billing FAQ ───────────────────────────────────────── */}
      <section className={styles.pricingFaq} id="faq-cobranca">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionBadge}>Dúvidas sobre cobrança</div>
            <h2 className={styles.sectionTitle}>
              Perguntas{' '}
              <span className={styles.sectionTitleAccent}>frequentes</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              Tudo o que você precisa saber sobre planos, pagamentos e assinatura.
            </p>
          </div>

          <div className={styles.pricingFaqList}>
            {billingFaqs.map((faq, i) => (
              <div
                key={i}
                className={`${styles.faqItem} ${openFaq === i ? styles.faqItemOpen : ''}`}
              >
                <button
                  className={styles.faqQuestion}
                  onClick={() => toggleFaq(i)}
                  aria-expanded={openFaq === i}
                  id={`billing-faq-${i}`}
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    size={18}
                    className={`${styles.faqChevron} ${openFaq === i ? styles.faqChevronOpen : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className={styles.faqAnswer}>
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
