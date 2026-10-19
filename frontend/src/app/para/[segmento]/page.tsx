import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LandingHeader from '../../landing/components/LandingHeader';
import LandingFooter from '../../landing/components/LandingFooter';
import RegisterLink from '../../landing/components/RegisterLink';
import ui from '../../landing/landing.module.scss';
import { getSegment, segments } from '../data/segments';
import { SITE_URL, openGraphFor } from '@/lib/seo';
import styles from './segment.module.scss';

type Params = { segmento: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return segments.map((s) => ({ segmento: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { segmento } = await params;
  const segment = getSegment(segmento);
  if (!segment) return {};
  const path = `/para/${segment.slug}`;
  return {
    title: segment.metaTitle,
    description: segment.metaDescription,
    alternates: { canonical: path },
    openGraph: openGraphFor({ title: segment.metaTitle, description: segment.metaDescription, path }),
  };
}

const statusClass = {
  Aprovado: styles.ok,
  'Em análise': styles.review,
  Pendente: styles.pending,
  Rejeitado: styles.rejected,
} as const;

export default async function SegmentPage({ params }: { params: Promise<Params> }) {
  const { segmento } = await params;
  const segment = getSegment(segmento);
  if (!segment) notFound();

  const url = `${SITE_URL}/para/${segment.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Bentifiles', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: segment.label, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: segment.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
  };
  const others = segments.filter((s) => s.slug !== segment.slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <LandingHeader />
      <main>
        <section className={styles.hero}>
          <div className={`${ui.wrap} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={ui.kicker}>Para {segment.label.toLowerCase()}</p>
              <h1>{segment.h1}</h1>
              <p className={styles.lead}>{segment.lead}</p>
              <div className={styles.cta}>
                <RegisterLink className={`${ui.btn} ${ui.btnAmber}`}>Criar conta</RegisterLink>
                <Link className={`${ui.btn} ${ui.btnGhost}`} href="/#planos">
                  Ver planos
                </Link>
              </div>
              <p className={styles.trial}>10 dias de teste no plano Individual.</p>
            </div>

            <figure className={styles.sheet}>
              <figcaption>
                <strong>{segment.checklist.title}</strong>
                <span>Lista de exemplo: você define os documentos de cada projeto.</span>
              </figcaption>
              <ul>
                {segment.checklist.items.map((item) => (
                  <li key={item.name}>
                    <div>
                      <span className={styles.docName}>{item.name}</span>
                      {item.reason && <span className={styles.reason}>Motivo: {item.reason}</span>}
                    </div>
                    <span className={`${styles.status} ${statusClass[item.status]}`}>{item.status}</span>
                  </li>
                ))}
              </ul>
            </figure>
          </div>
        </section>

        <section className={styles.problem}>
          <div className={`${ui.wrap} ${styles.problemGrid}`}>
            <h2>{segment.problemTitle}</h2>
            <p>{segment.problem}</p>
          </div>
        </section>

        <section className={styles.steps}>
          <div className={ui.wrap}>
            <p className={ui.kicker}>Como fica na rotina</p>
            <ol>
              {segment.steps.map((step, i) => (
                <li key={step.title}>
                  <span className={styles.num} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2>{step.title}</h2>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.faq}>
          <div className={`${ui.wrap} ${styles.faqGrid}`}>
            <div>
              <p className={ui.kicker}>Perguntas frequentes</p>
              <h2>O que {segment.label.toLowerCase()} costumam perguntar.</h2>
            </div>
            <div className={styles.faqList}>
              {segment.faqs.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.closing}>
          <div className={`${ui.wrap} ${styles.closingGrid}`}>
            <div>
              <h2>Peça o documento. Receba legível.</h2>
              <RegisterLink className={`${ui.btn} ${ui.btnAmber}`}>Criar conta</RegisterLink>
            </div>
            <nav aria-label="Mais informações">
              <p className={ui.kicker}>Para outros públicos</p>
              <ul>
                {others.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/para/${s.slug}`}>{s.label}</Link>
                  </li>
                ))}
              </ul>
              <p className={ui.kicker}>Na documentação</p>
              <ul>
                <li>
                  <Link href="/docs/pedir/criar-um-projeto">Criar um projeto</Link>
                </li>
                <li>
                  <Link href="/docs/pedir/convidar-pessoas">Convidar pessoas</Link>
                </li>
                <li>
                  <Link href="/docs/enviar/como-funciona-a-validacao">Como funciona a validação</Link>
                </li>
              </ul>
            </nav>
          </div>
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
