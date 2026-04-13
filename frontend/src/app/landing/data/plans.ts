// plans.ts — Bentifiles Pricing Data
// Centralized data source for all pricing plans.
// When connecting Stripe, replace the priceId values with real Stripe Price IDs
// from your Stripe Dashboard → Products.

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: string; // formatted display price
  priceRaw: number; // numeric value in BRL for sorting/logic
  period: string;
  priceId: string; // Stripe Price ID — replace with real value before go-live
  features: PlanFeature[];
  highlighted: boolean; // true = "Mais popular" badge + visual emphasis
  ctaLabel: string;
  badge?: string;
}

export const plans: Plan[] = [
  {
    id: 'individual',
    name: 'Individual',
    description: 'Ideal para profissionais autônomos que precisam de organização e produtividade no dia a dia.',
    price: 'R$ 64,98',
    priceRaw: 64.98,
    period: '/mês',
    priceId: 'price_individual_monthly', // TODO: substituir pelo Price ID real do Stripe
    highlighted: false,
    ctaLabel: 'Assinar Individual',
    features: [
      { text: 'Gestão completa de documentos', included: true },
      { text: 'Organização por projeto (até 3)', included: true },
      { text: 'Biblioteca de templates', included: true },
      { text: 'Painel centralizado', included: true },
      { text: 'Upload de arquivos (5 GB)', included: true },
      { text: 'Colaboração com equipe', included: false },
      { text: 'Administração de usuários', included: false },
      { text: 'Suporte prioritário', included: false },
    ],
  },
  {
    id: 'profissional',
    name: 'Profissional',
    description: 'Para times e profissionais que precisam de colaboração, escala e controle organizacional.',
    price: 'R$ 129,98',
    priceRaw: 129.98,
    period: '/mês',
    priceId: 'price_professional_monthly', // TODO: substituir pelo Price ID real do Stripe
    highlighted: true,
    badge: 'Mais popular',
    ctaLabel: 'Assinar Profissional',
    features: [
      { text: 'Tudo do plano Individual', included: true },
      { text: 'Projetos ilimitados', included: true },
      { text: 'Colaboração com equipe (até 10 membros)', included: true },
      { text: 'Administração de usuários', included: true },
      { text: 'Upload de arquivos (50 GB)', included: true },
      { text: 'Controle de permissões por projeto', included: true },
      { text: 'Templates avançados', included: true },
      { text: 'Suporte prioritário', included: false },
    ],
  },
  {
    id: 'empresarial',
    name: 'Empresarial',
    description: 'Estrutura robusta para empresas que precisam de escala, controle total e suporte dedicado.',
    price: 'R$ 249,98',
    priceRaw: 249.98,
    period: '/mês',
    priceId: 'price_business_monthly', // TODO: substituir pelo Price ID real do Stripe
    highlighted: false,
    ctaLabel: 'Assinar Empresarial',
    features: [
      { text: 'Tudo do plano Profissional', included: true },
      { text: 'Colaboração ilimitada de membros', included: true },
      { text: 'Armazenamento ilimitado', included: true },
      { text: 'Suporte prioritário dedicado', included: true },
      { text: 'SLA garantido', included: true },
      { text: 'Onboarding personalizado', included: true },
      { text: 'Relatórios e auditoria avançada', included: true },
      { text: 'Ambiente multi-organização', included: true },
    ],
  },
];

// ─── Billing FAQ ───────────────────────────────────────────────────────────
export interface BillingFaq {
  question: string;
  answer: string;
}

export const billingFaqs: BillingFaq[] = [
  {
    question: 'Posso trocar de plano depois?',
    answer:
      'Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. A cobrança é proporcional ao período restante do ciclo atual.',
  },
  {
    question: 'O pagamento é mensal?',
    answer:
      'Sim, a cobrança padrão é mensal. O valor é debitado automaticamente todo mês no cartão de crédito ou método escolhido.',
  },
  {
    question: 'Como funciona a assinatura?',
    answer:
      'Após selecionar um plano, você será redirecionado para o checkout seguro via Stripe. Basta inserir os dados de pagamento e pronto — o acesso é liberado imediatamente.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim. O cancelamento pode ser feito a qualquer momento pelo seu painel. Você continua com acesso até o fim do período já pago.',
  },
  {
    question: 'O acesso é liberado imediatamente?',
    answer:
      'Sim! Assim que o pagamento for confirmado pelo Stripe, sua conta é atualizada e você já pode utilizar todos os recursos do plano escolhido.',
  },
  {
    question: 'Há período de teste gratuito?',
    answer:
      'Oferecemos 7 dias de teste gratuito no plano Profissional. Nenhum cartão é necessário para iniciar o período de teste.',
  },
];
