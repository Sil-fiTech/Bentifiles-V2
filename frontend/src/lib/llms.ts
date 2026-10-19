import fs from 'node:fs';
import path from 'node:path';
import { plans } from '@/app/landing/data/plans';
import { segments } from '@/app/para/data/segments';
import { getAllPosts, getPostSource } from '@/lib/blog/content';
import { getAllPages, getNav } from '@/lib/docs/content';
import { SITE_URL } from '@/lib/seo';

// Conteúdo de /llms.txt e /llms-full.txt (padrão llmstxt.org): um resumo do produto para assistentes
// de IA, gerado das mesmas fontes que o site exibe. Os fatos abaixo seguem a documentação;
// ao mudar o produto, atualize aqui e nas páginas de /docs.

function priceLines(): string[] {
    return plans.map((p) => {
        if (!p.monthlyPrice) return `- ${p.name}: sob consulta.`;
        const annual = p.annualMonthlyPrice ? ` ou ${p.annualMonthlyPrice} no anual (${p.annualTotal})` : '';
        return `- ${p.name}: ${p.monthlyPrice}/mês${annual}.`;
    });
}

function header(): string {
    return [
        '# Bentifiles',
        '',
        '> Bentifiles é uma plataforma brasileira, 100% web, para pedir, receber e conferir documentos de clientes num lugar só. Quem pede cria um projeto, define os documentos (à mão ou com templates), convida as pessoas por link ou e-mail, e cada uma envia pelo próprio checklist. Toda imagem enviada passa por uma validação automática de legibilidade feita com IA e é recusada na hora se não der para ler. Produto da Silfi-Tech (CNPJ 62.326.981/0001-19).',
        '',
        'Fatos principais:',
        '- Público: escritórios de contabilidade e advocacia, imobiliárias, RH/departamento pessoal e profissionais autônomos que cobram documentos de clientes.',
        '- Formatos aceitos: JPG, JPEG, PNG, PDF e DOCX, até 10 MB por arquivo.',
        '- Validação automática (só imagens JPG, JPEG e PNG): localiza o documento na foto, endireita a perspectiva e avalia nitidez, brilho e contraste, reflexo, presença de texto e enquadramento. Resultado: Aprovada, Revisão (uma pessoa decide) ou Rejeitada (o arquivo não é salvo). PDF e DOCX vão direto para revisão.',
        '- A validação avalia legibilidade, não autenticidade: não detecta fraude nem confere os dados.',
        '- Quem pede aprova ou rejeita cada documento; na rejeição informa um motivo, que quem enviou vê junto com o botão de reenviar.',
        '- Download de um documento ou do projeto inteiro em ZIP (PDF ou formato original), com arquivos nomeados por tipo de documento + pessoa + nome original.',
        '- Quem envia documentos não paga, mas precisa criar conta gratuita (ou entrar com Google). Convites valem 24 horas.',
        '- Não oferece: assinatura digital, verificação de autenticidade, integração com ERP.',
        '- Também escrito como "Benti Files" ou "BentiFiles".',
        '',
        'Planos (pagamento via Stripe, cancelamento pelo painel; 10 dias de teste só no Individual):',
        ...priceLines(),
    ].join('\n');
}

const link = (title: string, href: string, note?: string) => `- [${title}](${SITE_URL}${href})${note ? `: ${note}` : ''}`;

export async function buildLlmsTxt(): Promise<string> {
    const [nav, posts] = await Promise.all([getNav(), getAllPosts()]);
    return [
        header(),
        '',
        '## Produto',
        '',
        link('Página inicial e planos', '/', 'o que é, como funciona, recursos, preços e perguntas frequentes'),
        ...segments.map((s) => link(`Bentifiles para ${s.label.toLowerCase()}`, `/para/${s.slug}`, s.metaDescription)),
        '',
        '## Blog',
        '',
        ...posts.map((p) => link(p.title, p.href, p.description)),
        ...nav.flatMap((section) => ['', `## Documentação: ${section.title}`, '', ...section.pages.map((p) => link(p.title, p.href))]),
        '',
        '## Optional',
        '',
        link('Conteúdo completo do blog e da documentação em um arquivo', '/llms-full.txt'),
        link('Vídeos da documentação', '/docs/videos'),
        '- [Silfi-Tech](https://www.silfi-tech.net/)',
        '',
    ].join('\n');
}

const DOCS_ROOT = path.join(process.cwd(), 'src', 'content', 'docs');
const stripMeta = (raw: string) => raw.replace(/^export const meta = \{[\s\S]*?\n\};\n/, '').trim();

export async function buildLlmsFullTxt(): Promise<string> {
    const [posts, pages] = await Promise.all([getAllPosts(), getAllPages()]);
    const parts = [
        ...posts.map((p) => ({ title: p.title, href: p.href, body: getPostSource(p.slug) })),
        ...pages.map((p) => ({
            title: p.title,
            href: p.href,
            body: stripMeta(fs.readFileSync(path.join(DOCS_ROOT, `${p.slug.join('/')}.mdx`), 'utf-8')),
        })),
    ];
    const sections = parts.map(
        (p) => `---\n\n# ${p.title}\n\nFonte: ${SITE_URL}${p.href}\n\n${p.body.replaceAll('](/', `](${SITE_URL}/`)}`,
    );
    return [header(), ...sections].join('\n\n') + '\n';
}
