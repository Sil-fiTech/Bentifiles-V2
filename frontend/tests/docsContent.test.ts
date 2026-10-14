import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../src/lib/docs/sections';

// Garante que o conteúdo da documentação continua consistente com o que o site espera.
const ROOT = path.join(__dirname, '..', 'src', 'content', 'docs');
const pages = SECTIONS.flatMap((s) =>
  fs.existsSync(path.join(ROOT, s.id))
    ? fs.readdirSync(path.join(ROOT, s.id)).filter((f) => f.endsWith('.mdx')).map((f) => ({ section: s.id, file: f }))
    : [],
);
const read = (p: { section: string; file: string }) => fs.readFileSync(path.join(ROOT, p.section, p.file), 'utf-8');

describe('conteúdo da documentação', () => {
  it('não há pasta de conteúdo fora das seções declaradas', () => {
    const ids = new Set(SECTIONS.map((s) => s.id));
    const dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(dirs.filter((d) => !ids.has(d))).toEqual([]);
  });

  it('toda seção tem ao menos uma página', () => {
    for (const s of SECTIONS) expect(pages.some((p) => p.section === s.id), s.id).toBe(true);
  });

  it.each(pages.map((p) => [`${p.section}/${p.file}`, p] as const))('%s exporta meta válido', (_name, p) => {
    const src = read(p);
    expect(src).toMatch(/^export const meta = \{/);
    expect(src).toMatch(/title: '.+'/);
    expect(src).toMatch(/description: '.+'/);
    expect(src).toMatch(/order: \d+/);
  });

  it('o `order` não se repete dentro de uma seção', () => {
    for (const s of SECTIONS) {
      const orders = pages.filter((p) => p.section === s.id).map((p) => read(p).match(/order: (\d+)/)?.[1]);
      expect(new Set(orders).size, `ordem repetida em ${s.id}`).toBe(orders.length);
    }
  });
});
