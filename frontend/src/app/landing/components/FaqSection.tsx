'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from '../landing.module.scss';

const faqs = [
  {
    question: 'O que é o Bentifiles?',
    answer:
      'O Bentifiles é uma plataforma de gestão de documentos, projetos e templates. Ele centraliza todos os arquivos da sua equipe em um ambiente organizado, padronizado e de fácil acesso.',
  },
  {
    question: 'Para quem a plataforma é indicada?',
    answer:
      'O Bentifiles é ideal para equipes, empresas e profissionais que lidam com grande volume de documentos e precisam de organização, padronização e controle sobre arquivos e projetos. Serve desde pequenas equipes até empresas em expansão.',
  },
  {
    question: 'Posso organizar documentos por projeto?',
    answer:
      'Sim! Cada projeto tem seu próprio espaço isolado, com documentos, membros e templates independentes. É possível criar quantos projetos forem necessários e organizar os arquivos dentro de cada um.',
  },
  {
    question: 'É possível usar templates?',
    answer:
      'Com certeza. Você pode criar templates de documentos personalizados para sua empresa e reutilizá-los em qualquer projeto. Isso garante padronização e agilidade na criação de novos arquivos.',
  },
  {
    question: 'O Bentifiles é indicado para equipes?',
    answer:
      'Absolutamente. O sistema foi projetado para colaboração em equipe. Você pode adicionar membros a projetos, controlar acessos e garantir que todos trabalhem com as mesmas informações e estruturas.',
  },
  {
    question: 'Preciso instalar algo?',
    answer:
      'Não. O Bentifiles é uma plataforma 100% web, acessível direto pelo navegador. Não é necessário instalar nada, em nenhum dispositivo.',
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section className={styles.faq} id="faq">
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionBadge}>FAQ</div>
          <h2 className={styles.sectionTitle}>
            Perguntas{' '}
            <span className={styles.sectionTitleAccent}>frequentes</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            Tire as principais dúvidas sobre a plataforma antes de começar.
          </p>
        </div>

        <div className={styles.faqList}>
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`${styles.faqItem} ${openIndex === i ? styles.faqItemOpen : ''}`}
            >
              <button
                className={styles.faqQuestion}
                onClick={() => toggle(i)}
                aria-expanded={openIndex === i}
                id={`faq-item-${i}`}
              >
                <span>{faq.question}</span>
                <ChevronDown
                  size={18}
                  className={`${styles.faqChevron} ${openIndex === i ? styles.faqChevronOpen : ''}`}
                />
              </button>
              {openIndex === i && (
                <div className={styles.faqAnswer}>
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
