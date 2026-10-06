import { describe, expect, it } from 'vitest';
import { generateVerificationToken } from '../src/utils/cryptoUtil';

describe('generateVerificationToken', () => {
  it('gera 32 bytes em hexadecimal', () => {
    expect(generateVerificationToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('não repete valores', () => {
    expect(generateVerificationToken()).not.toBe(generateVerificationToken());
  });
});
