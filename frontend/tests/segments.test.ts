import { describe, expect, it } from 'vitest';
import { segments } from '../src/app/para/data/segments';

// Protege o SEO das páginas por segmento: títulos/descrições cabem no resultado do Google e não se repetem.
describe('páginas por segmento (/para)', () => {
  it('slugs únicos', () => {
    expect(new Set(segments.map((s) => s.slug)).size).toBe(segments.length);
  });

  it.each(segments.map((s) => [s.slug, s] as const))('%s: título e descrição cabem na busca', (_slug, s) => {
    // O layout acrescenta " | Bentifiles" (13 caracteres) ao título.
    expect(s.metaTitle.length + 13).toBeLessThanOrEqual(62);
    expect(s.metaDescription.length).toBeGreaterThanOrEqual(110);
    expect(s.metaDescription.length).toBeLessThanOrEqual(160);
  });

  it('títulos e descrições não se repetem entre segmentos', () => {
    expect(new Set(segments.map((s) => s.metaTitle)).size).toBe(segments.length);
    expect(new Set(segments.map((s) => s.metaDescription)).size).toBe(segments.length);
  });

  it.each(segments.map((s) => [s.slug, s] as const))('%s: checklist de exemplo mostra o motivo da rejeição', (_slug, s) => {
    for (const item of s.checklist.items) {
      expect(Boolean(item.reason), item.name).toBe(item.status === 'Rejeitado');
    }
  });
});
