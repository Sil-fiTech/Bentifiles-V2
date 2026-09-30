// Perguntas frequentes da landing. Respostas conforme o FAQ anterior do produto.
export interface Faq {
  question: string;
  answer: string;
}

export const faqs: Faq[] = [
  {
    question: 'O que é o Bentifiles?',
    answer:
      'É uma plataforma de gestão de documentos, projetos e templates. Ela centraliza os arquivos da sua equipe em um ambiente organizado, padronizado e de fácil acesso.',
  },
  {
    question: 'Para quem a plataforma é indicada?',
    answer:
      'Para equipes, empresas e profissionais que lidam com grande volume de documentos e precisam de organização, padronização e controle. Serve desde pequenas equipes até empresas em expansão.',
  },
  {
    question: 'Posso organizar documentos por projeto?',
    answer:
      'Sim. Cada projeto tem seu próprio espaço isolado, com documentos, membros e templates independentes. Você pode criar quantos projetos precisar.',
  },
  {
    question: 'É possível usar templates?',
    answer:
      'Sim. Você pode criar templates de documentos personalizados para a sua empresa e reutilizá-los em qualquer projeto.',
  },
  {
    question: 'Preciso instalar algo?',
    answer: 'Não. O Bentifiles é 100% web, acessível direto pelo navegador, em qualquer dispositivo.',
  },
  {
    question: 'Há período de teste gratuito?',
    answer: 'Sim. No plano Individual, você pode testar o Bentifiles por 10 dias antes do primeiro pagamento.',
  },
  {
    question: 'Como funciona a assinatura?',
    answer:
      'Depois de escolher um plano, você é levado ao checkout seguro. Basta informar os dados de pagamento; o acesso é liberado após a confirmação.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer: 'Sim, pelo seu painel, a qualquer momento. Você continua com acesso até o fim do período já pago.',
  },
  {
    question: 'Posso trocar de plano depois?',
    answer:
      'Sim. Você pode fazer upgrade ou downgrade a qualquer momento. A cobrança é proporcional ao período restante do ciclo.',
  },
];
