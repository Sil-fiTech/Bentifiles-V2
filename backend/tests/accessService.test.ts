import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@prisma/client';
import { computeSystemAccess, getAccessRedirect } from '../src/services/accessService';

const NOW = new Date('2026-06-01T12:00:00Z');
const user = (over: Partial<User>) => over as User;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('computeSystemAccess', () => {
  it('libera assinatura ativa', () => {
    expect(computeSystemAccess(user({ subscriptionStatus: 'ACTIVE' }))).toBe(true);
  });

  it('libera trial que ainda não expirou', () => {
    const trial = user({ subscriptionStatus: 'TRIALING', subscriptionTrialEndsAt: new Date('2026-06-02T00:00:00Z') });
    expect(computeSystemAccess(trial)).toBe(true);
  });

  it('bloqueia trial expirado', () => {
    const trial = user({ subscriptionStatus: 'TRIALING', subscriptionTrialEndsAt: new Date('2026-05-31T00:00:00Z') });
    expect(computeSystemAccess(trial)).toBe(false);
  });

  it('bloqueia trial sem data de fim', () => {
    expect(computeSystemAccess(user({ subscriptionStatus: 'TRIALING', subscriptionTrialEndsAt: null }))).toBe(false);
  });

  it.each(['CANCELED', 'PAST_DUE', 'NONE'])('bloqueia status %s', (status) => {
    expect(computeSystemAccess(user({ subscriptionStatus: status as User['subscriptionStatus'] }))).toBe(false);
  });
});

describe('getAccessRedirect', () => {
  it('manda para /plans quando não há acesso', () => {
    expect(getAccessRedirect(user({ subscriptionStatus: 'CANCELED' }))).toBe('/plans');
  });

  it('não redireciona quem tem acesso', () => {
    expect(getAccessRedirect(user({ subscriptionStatus: 'ACTIVE' }))).toBeNull();
  });
});
