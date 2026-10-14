import fs from 'node:fs';
import path from 'node:path';
import type { ComponentType } from 'react';
import { SECTIONS } from './sections';
import { slugify } from './slugify';

// Cada página é um arquivo src/content/docs/<secao>/<pagina>.mdx que exporta `meta`.
const ROOT = path.join(process.cwd(), 'src', 'content', 'docs');

export interface DocMeta {
    title: string;
    description: string;
    /** Posição dentro da seção (menor primeiro). */
    order: number;
    /** ID do vídeo no YouTube (não listado). Sem ele, a página mostra "vídeo em breve". */
    video?: string;
    /** Duração aproximada, só para exibir (ex.: "3 min"). */
    duration?: string;
}

export interface DocPage extends DocMeta {
    slug: string[];
    href: string;
    section: string;
}

export interface TocItem { id: string; text: string }

function listFiles(): string[] {
    if (!fs.existsSync(ROOT)) return [];
    return SECTIONS.flatMap((section) => {
        const dir = path.join(ROOT, section.id);
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
            .filter((f) => f.endsWith('.mdx'))
            .map((f) => `${section.id}/${f.replace(/\.mdx$/, '')}`);
    });
}

async function loadModule(file: string): Promise<{ default: ComponentType; meta: DocMeta }> {
    return import(`../../content/docs/${file}.mdx`);
}

let cache: DocPage[] | null = null;

/** Todas as páginas, na ordem do menu (seção, depois `order`). */
export async function getAllPages(): Promise<DocPage[]> {
    if (cache) return cache;
    const pages = await Promise.all(
        listFiles().map(async (file) => {
            const mod = await loadModule(file);
            const [section] = file.split('/');
            return { ...mod.meta, slug: file.split('/'), href: `/docs/${file}`, section } as DocPage;
        }),
    );
    const sectionIndex = (id: string) => SECTIONS.findIndex((s) => s.id === id);
    pages.sort((a, b) => sectionIndex(a.section) - sectionIndex(b.section) || a.order - b.order);
    cache = pages;
    return pages;
}

export async function getNav() {
    const pages = await getAllPages();
    return SECTIONS.map((section) => ({
        ...section,
        pages: pages.filter((p) => p.section === section.id).map((p) => ({ title: p.title, href: p.href })),
    })).filter((s) => s.pages.length > 0);
}

export async function getPage(slug: string[]) {
    const file = slug.join('/');
    if (!listFiles().includes(file)) return null;
    const mod = await loadModule(file);
    return { Content: mod.default, meta: mod.meta, slug, file };
}

/** Índice "Nesta página": títulos de nível 2 lidos do próprio arquivo. */
export function getToc(file: string): TocItem[] {
    const raw = fs.readFileSync(path.join(ROOT, `${file}.mdx`), 'utf-8');
    return [...raw.matchAll(/^##\s+(.+)$/gm)].map((m) => ({ text: m[1].trim(), id: slugify(m[1]) }));
}

export async function getNeighbours(href: string) {
    const pages = await getAllPages();
    const i = pages.findIndex((p) => p.href === href);
    return { prev: i > 0 ? pages[i - 1] : null, next: i >= 0 && i < pages.length - 1 ? pages[i + 1] : null };
}
