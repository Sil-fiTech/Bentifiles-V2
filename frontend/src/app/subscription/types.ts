export interface Invoice {
  id: string;
  amountDue: number;
  amountPaid: number;
  status: string; // 'paid', 'open', 'void', 'uncollectible', etc.
  created: string; // ISO String
  pdfUrl: string | null;
}

export interface SubscriptionData {
  subscriptionStatus: string; // 'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'none'
  planId: string;
  planName: string;
  billingInterval: 'monthly' | 'yearly';
  amount: number;
  quantity?: number;
  currency: string;
  currentPeriodStart: string; // ISO String
  currentPeriodEnd: string; // ISO String
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null; // ISO String se estiver em trial
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  paymentMethodSummary: string | null; // ex: 'Visa terminando em 4242'
  invoices: Invoice[];
}

export interface PlanData {
  id: string;
  name: string;
  monthlyPrice: number | 'Personalizado';
  yearlyPrice: number | 'Personalizado';
  description: string;
  features: string[];
}
