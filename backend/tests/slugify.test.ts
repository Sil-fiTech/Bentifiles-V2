import { describe, expect, it } from 'vitest';
import { generateSlug } from '../src/utils/slugify';

describe('generateSlug', () => {
  it('remove acentos e coloca em minúsculas', () => {
    expect(generateSlug('Ação Rápida')).toBe('acao-rapida');
  });

  it('troca espaços e underscores por hífen', () => {
    expect(generateSlug('meu_projeto  novo')).toBe('meu-projeto-novo');
  });

  it('remove caracteres especiais e colapsa hífens', () => {
    expect(generateSlug('Contrato (2024) -- final!')).toBe('contrato-2024-final');
  });
});
