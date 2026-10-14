import { describe, expect, it } from 'vitest';
import type { User } from '@prisma/client';
import { canCreateProject, getBillingEntitlements } from '../src/services/billingAccessService';

const user = (over: Partial<User>) => over as User;

describe('canCreateProject', () => {
  it.each(['ACTIVE', 'TRIALING'])('permite com status %s', (status) => {
    expect(canCreateProject(user({ subscriptionStatus: status as User['subscriptionStatus'] }))).toBe(true);
  });

  it('não permite sem assinatura ativa', () => {
    expect(canCreateProject(user({ subscriptionStatus: 'CANCELED' }))).toBe(false);
  });
});

describe('getBillingEntitlements', () => {
  const canceled = user({ subscriptionStatus: 'CANCELED' });
  const seat = {
    subscriptionId: 'sub_1',
    owner: { id: 'u1', name: 'Dono', email: 'dono@example.com' },
    seatType: 'OFFICE',
    plan: 'OFFICE',
    status: 'ACTIVE',
    totalSeats: 5,
    usedSeats: 2,
    availableSeats: 3,
  };

  it('sem override: acesso e criação seguem a assinatura do usuário', () => {
    const e = getBillingEntitlements(canceled);
    expect(e.hasSystemAccess).toBe(false);
    expect(e.canCreateProject).toBe(false);
    expect(e.officeSeatAccess).toBeNull();
  });

  it('licença de escritório concede acesso ao sistema', () => {
    expect(getBillingEntitlements(canceled, { officeSeatAccess: seat }).hasSystemAccess).toBe(true);
  });

  it('override explícito de canCreateProject prevalece', () => {
    expect(getBillingEntitlements(canceled, { canCreateProject: true }).canCreateProject).toBe(true);
  });
});
