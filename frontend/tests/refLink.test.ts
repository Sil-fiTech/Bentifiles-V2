import { afterEach, describe, expect, it, vi } from 'vitest';
import { withRefParam } from '../src/lib/affiliate/refLink';

const at = (search: string) => vi.stubGlobal('window', { location: { search } });
afterEach(() => vi.unstubAllGlobals());

describe('withRefParam', () => {
  it('sem window (SSR) devolve o caminho intacto', () => {
    expect(withRefParam('/login')).toBe('/login');
  });

  it('sem ?ref= devolve o caminho intacto', () => {
    at('?utm=x');
    expect(withRefParam('/login')).toBe('/login');
  });

  it('propaga o código do afiliado', () => {
    at('?ref=abc123');
    expect(withRefParam('/login')).toBe('/login?ref=abc123');
  });

  it('usa & quando o caminho já tem query', () => {
    at('?ref=abc123');
    expect(withRefParam('/login?mode=signup')).toBe('/login?mode=signup&ref=abc123');
  });

  it('ignora ref vazio e codifica caracteres especiais', () => {
    at('?ref=%20%20');
    expect(withRefParam('/login')).toBe('/login');
    at('?ref=a%26b');
    expect(withRefParam('/login')).toBe('/login?ref=a%26b');
  });
});
