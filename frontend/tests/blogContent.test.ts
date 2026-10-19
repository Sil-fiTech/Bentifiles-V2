import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Garante que os posts continuam no formato que o blog, o sitemap e o llms.txt esperam.
const ROOT = path.join(__dirname, '..', 'src', 'content', 'blog');
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.mdx'));
const slugs = new Set(files.map((f) => f.replace(/\.mdx$/, '')));
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf-8');

describe('conteúdo do blog', () => {
  it('tem ao menos um post', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s exporta meta válido', (f) => {
    const src = read(f);
    expect(src).toMatch(/^export const meta = \{/);
    expect(src).toMatch(/title: '.+'/);
    expect(src).toMatch(/description: '.+'/);
    expect(src).toMatch(/date: '\d{4}-\d{2}-\d{2}'/);
    expect(src).toMatch(/updated: '\d{4}-\d{2}-\d{2}'/);
  });

  it.each(files)('%s não repete o título como # (a página já mostra o meta.title)', (f) => {
    expect(read(f)).not.toMatch(/^# /m);
  });

  it.each(files)('%s só linka posts que existem', (f) => {
    const links = [...read(f).matchAll(/\]\(\/blog\/([^)#]+)\)/g)].map((m) => m[1]);
    for (const slug of links) expect(slugs.has(slug), slug).toBe(true);
  });
});
