import { buildLlmsTxt } from '@/lib/llms';

// Gerado no build a partir do conteúdo do site (ver src/lib/llms.ts).
export const dynamic = 'force-static';

export async function GET() {
    return new Response(await buildLlmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
