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
  currentPeriodStart: string | null; // ISO String
  currentPeriodEnd: string | null; // ISO String
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null; // ISO String se estiver em trial
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  paymentMethodSummary: string | null; // ex: 'Visa terminando em 4242'
  invoices: Invoice[];
  officeWorkspace?: OfficeWorkspace | null;
  officeSeatAccess?: OfficeSeatAccess | null;
}

export interface OfficeSeatAccess {
  subscriptionId: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  seatType: 'OWNER' | 'MEMBER';
  plan: string;
  status: string;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
}

export interface OfficeWorkspaceMember {
  id: string;
  userId: string;
  seatType: 'OWNER' | 'MEMBER';
  status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface OfficeWorkspaceInvite {
  id: string;
  email: string;
  token: string;
  link: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedByUserId: string;
  acceptedByUserId: string | null;
  acceptedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeWorkspace {
  subscriptionId: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  plan: string;
  status: string;
  billingInterval: string | null;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
  currentPeriodEnd: string | null;
  members: OfficeWorkspaceMember[];
  invites: OfficeWorkspaceInvite[];
}

export interface PlanData {
  id: string;
  name: string;
  monthlyPrice: number | 'Personalizado';
  yearlyPrice: number | 'Personalizado';
  description: string;
  features: string[];
}
