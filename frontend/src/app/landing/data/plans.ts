// plans.ts - Bentifiles Pricing Data
// Centralized data source for all pricing plans.
// When connecting Stripe, replace the priceId values with real Stripe Price IDs
// from your Stripe Dashboard -> Products.

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice?: string;
  monthlyPriceRaw?: number;
  annualPrice?: string;
  annualPriceRaw?: number;
  annualMonthlyPrice?: string;
  annualTotal?: string;
  discount?: string;
  priceNote?: string;
  contactLabel?: string;
  priceId: string; // Stripe Price ID - replace with real value before go-live
  features: PlanFeature[];
  highlighted: boolean; // true = "Mais popular" badge + visual emphasis
  ctaLabel: string;
  badge?: string;
}

export const plans: Plan[] = [
  {
    id: 'individual',
    name: 'Individual',
    description: 'Ideal para profissionais autônomos que precisam de organização e produtividade no dia a dia, com 10 dias de teste antes da cobrança.',
    monthlyPrice: 'R$ 64,98',
    monthlyPriceRaw: 64.98,
    annualPrice: 'R$ 49,98',
    annualPriceRaw: 49.98,
    annualMonthlyPrice: 'R$ 49,98/mês',
    annualTotal: 'R$ 599,76/ano',
    discount: '23%',
    priceNote: 'No plano Individual, você pode testar por 10 dias. No anual, o valor mensal cai para 49,98.',
    priceId: 'price_individual_monthly',
    highlighted: false,
    ctaLabel: 'Assinar Individual',
    features: [],
  },
  {
    id: 'office',
    name: 'Office (por acesso)',
    description: 'Para equipes que precisam de colaboração por acesso, escala e controle organizacional.',
    monthlyPrice: 'R$ 49,98',
    monthlyPriceRaw: 49.98,
    annualPrice: 'R$ 44,98',
    annualPriceRaw: 44.98,
    annualMonthlyPrice: 'R$ 44,98/mês',
    annualTotal: 'R$ 539,76/ano',
    discount: '10%',
    priceNote: 'Valor por acesso com economia no faturamento anual.',
    priceId: 'price_office_monthly',
    highlighted: true,
    badge: 'Mais popular',
    ctaLabel: 'Assinar Office',
    features: [],
  },
  {
    id: 'empresarial',
    name: 'Empresarial',
    description: 'Estrutura robusta para empresas que precisam de escala, controle total e suporte dedicado.',
    contactLabel: 'Entre em contato',
    priceNote: 'Plano customizado para operações com onboarding, suporte dedicado e necessidades avançadas.',
    priceId: 'price_business_contact',
    highlighted: false,
    ctaLabel: 'Falar com vendas',
    features: [],
  },
];

export interface BillingFaq {
  question: string;
  answer: string;
}

export const billingFaqs: BillingFaq[] = [
  {
    question: 'Posso trocar de plano depois?',
    answer:
      'Sim. Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. A cobrança é proporcional ao período restante do ciclo atual.',
  },
  {
    question: 'O pagamento é mensal?',
    answer:
      'Você pode contratar no ciclo mensal ou anual, conforme o plano escolhido. Em ambos os casos, a renovação segue o período contratado.',
  },
  {
    question: 'Como funciona a assinatura?',
    answer:
      'Após selecionar um plano, você será redirecionado para o checkout seguro. Basta inserir os dados de pagamento e o acesso é liberado após a confirmação.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim. O cancelamento pode ser feito a qualquer momento pelo seu painel. Você continua com acesso até o fim do período já pago.',
  },
  {
    question: 'O acesso é liberado imediatamente?',
    answer:
      'Sim. Assim que o pagamento for confirmado, sua conta é atualizada e você já pode utilizar os recursos do plano escolhido.',
  },
  {
    question: 'Há período de teste gratuito?',
    answer:
      'Sim. No plano Individual, você pode testar o Bentifiles por 10 dias antes do primeiro pagamento.',
  },
];
