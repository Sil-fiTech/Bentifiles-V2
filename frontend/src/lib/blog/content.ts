import fs from 'node:fs';
import path from 'node:path';
import type { ComponentType } from 'react';

// Cada post é um arquivo src/content/blog/<slug>.mdx que exporta `meta`.
const ROOT = path.join(process.cwd(), 'src', 'content', 'blog');

export interface PostMeta {
    title: string;
    description: string;
    /** Datas no formato AAAA-MM-DD. */
    date: string;
    updated: string;
}

export interface Post extends PostMeta {
    slug: string;
    href: string;
}

function listSlugs(): string[] {
    if (!fs.existsSync(ROOT)) return [];
    return fs.readdirSync(ROOT).filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''));
}

async function loadModule(slug: string): Promise<{ default: ComponentType; meta: PostMeta }> {
    return import(`../../content/blog/${slug}.mdx`);
}

let cache: Post[] | null = null;

/** Todos os posts, do mais recente para o mais antigo. */
export async function getAllPosts(): Promise<Post[]> {
    if (cache) return cache;
    const posts = await Promise.all(
        listSlugs().map(async (slug) => ({ ...(await loadModule(slug)).meta, slug, href: `/blog/${slug}` })),
    );
    posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
    cache = posts;
    return posts;
}

export async function getPost(slug: string) {
    if (!listSlugs().includes(slug)) return null;
    const mod = await loadModule(slug);
    return { Content: mod.default, meta: mod.meta, slug };
}

/** Texto do post sem o `export const meta`, para o llms-full.txt. */
export function getPostSource(slug: string): string {
    const raw = fs.readFileSync(path.join(ROOT, `${slug}.mdx`), 'utf-8');
    return raw.replace(/^export const meta = \{[\s\S]*?\n\};\n/, '').trim();
}

/** "2026-10-19" → "19/10/2026" */
export function formatDate(iso: string): string {
    return iso.split('-').reverse().join('/');
}
