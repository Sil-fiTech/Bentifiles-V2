import { describe, expect, it } from 'vitest';
import { slugify } from '../src/lib/docs/slugify';

describe('slugify (docs)', () => {
  it('remove acentos e normaliza separadores', () => {
    expect(slugify('Como funciona a validação')).toBe('como-funciona-a-validacao');
  });

  it('tira hífens das pontas', () => {
    expect(slugify('  Quanto custa?  ')).toBe('quanto-custa');
  });
});
